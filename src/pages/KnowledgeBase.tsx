import { useState, useEffect } from 'react';
import { collection, addDoc, query, getDocs, orderBy, doc as firestoreDoc, updateDoc, deleteDoc, getDoc, setDoc, where, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '../lib/firebase';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { Upload, Search, FileText, BookOpen, DollarSign, GraduationCap, FileCheck, Wrench, File, Trash2, CreditCard as Edit, ExternalLink, Star, Clock } from 'lucide-react';
import { User } from '../types';

interface Document {
  id: string;
  title: string;
  category: string;
  securityLevel: 0 | 1 | 2 | 3;
  tags: string[];
  uploadedBy: string;
  uploadedAt: any;
  fileUrl: string;
  fileName: string;
  fileType: string;
  summary?: string;
  viewCount: number;
}

const securityLevelNames = {
  0: '公開',
  1: '社内限定',
  2: '機密',
  3: '極秘'
};

const securityLevelColors = {
  0: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  1: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  2: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  3: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
};

const categories = [
  { id: 'manual', name: '運航マニュアル', icon: BookOpen },
  { id: 'accounting', name: '経理・給与', icon: DollarSign },
  { id: 'training', name: '研修資料', icon: GraduationCap },
  { id: 'rules', name: '規則・規定', icon: FileCheck },
  { id: 'maintenance', name: 'メンテナンス', icon: Wrench },
  { id: 'other', name: 'その他', icon: File }
];

export function KnowledgeBase() {
  const { currentUser } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [securityLevel, setSecurityLevel] = useState<0 | 1 | 2 | 3>(1);
  const [category, setCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTags, setSearchTags] = useState<string[]>([]);
  const [searchCategory, setSearchCategory] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  // 編集関連のstate
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<Document | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedCategory, setEditedCategory] = useState('');
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [editedSecurityLevel, setEditedSecurityLevel] = useState<0 | 1 | 2 | 3>(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);

  const loadAvailableCategories = async () => {
    try {
      const q = query(collection(db, 'knowledge_categories'), orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      const categoriesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAvailableCategories(categoriesList);
    } catch (error) {
      console.error('カテゴリー読み込みエラー:', error);
    }
  };

  const loadFavorites = async () => {
    if (!auth.currentUser) return;

    try {
      const favDoc = await getDoc(firestoreDoc(db, 'user_favorites', auth.currentUser.uid));
      if (favDoc.exists()) {
        setFavorites(favDoc.data().documentIds || []);
      }
    } catch (error) {
      console.error('お気に入り読み込みエラー:', error);
    }
  };

  const loadRecentDocuments = async () => {
    if (!auth.currentUser) {
      console.log('最近閲覧: ユーザー未ログイン');
      return;
    }

    try {
      console.log('最近閲覧: 取得開始');

      const q = query(
        collection(db, 'access_logs'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('accessedAt', 'desc'),
        limit(20)
      );

      const snapshot = await getDocs(q);
      console.log('最近閲覧: ログ件数:', snapshot.docs.length);

      const viewOpenLogs = snapshot.docs.filter(doc => {
        const accessType = doc.data().accessType;
        return accessType === 'view' || accessType === 'open';
      });

      console.log('最近閲覧: view/open件数:', viewOpenLogs.length);

      const accessedDocIds = Array.from(new Set(
        viewOpenLogs.map(doc => {
          const data = doc.data();
          console.log('ログ:', data.documentId, data.documentTitle);
          return data.documentId;
        })
      )).slice(0, 5);

      console.log('最近閲覧: ドキュメントID一覧:', accessedDocIds);
      console.log('最近閲覧: 全文書数:', documents.length);

      const recentDocs = documents.filter(doc => {
        const match = accessedDocIds.includes(doc.id) && hasViewPermission(doc);
        if (match) console.log('最近閲覧: マッチ:', doc.title);
        return match;
      });

      console.log('最近閲覧: フィルター後:', recentDocs.length);

      const sortedDocs = accessedDocIds
        .map(id => recentDocs.find(doc => doc.id === id))
        .filter((doc): doc is Document => doc !== undefined);

      console.log('最近閲覧: 最終結果:', sortedDocs.length);
      setRecentDocuments(sortedDocs);
    } catch (error) {
      console.error('最近閲覧した文書の取得エラー:', error);
    }
  };

  useEffect(() => {
    loadAvailableCategories();
    loadDocuments();
    loadFavorites();
  }, [currentUser]);

  useEffect(() => {
    loadRecentDocuments();
  }, [documents]);

  const loadDocuments = async () => {
    if (!currentUser) return;

    try {
      const q = query(
        collection(db, 'knowledge_base'),
        orderBy('uploadedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Document[];

      const userPermissionLevel = getUserAccessLevel(currentUser);

      const filteredDocs = docs.filter(doc => {
        if (userPermissionLevel >= 3) return true;
        if (userPermissionLevel >= 2) return doc.securityLevel <= 2;
        if (userPermissionLevel >= 1) return doc.securityLevel <= 1;
        return doc.securityLevel === 0;
      });

      setDocuments(filteredDocs);
    } catch (error) {
      console.error('文書読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // ユーザーのナレッジベース閲覧レベルを取得
  const getUserAccessLevel = (user: User | null): number => {
    if (!user) return 0;

    // 個別設定がある場合はそれを優先
    if (user.knowledgeAccessLevel !== undefined) {
      return user.knowledgeAccessLevel;
    }

    // 役職による自動判定
    switch (user.role) {
      case 'owner_executive':
        return 3;
      case 'admin':
        return 3;  // 管理者も全閲覧可能
      case 'captain':
        return 1;
      default:
        return 0;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !currentUser) {
      alert('ファイルを選択してください');
      return;
    }

    if (!category) {
      alert('カテゴリを選択してください');
      return;
    }

    setUploading(true);

    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}_${selectedFile.name}`;
      const storageRef = ref(storage, `knowledge_base/${fileName}`);

      await uploadBytes(storageRef, selectedFile);
      const fileUrl = await getDownloadURL(storageRef);

      const docData = {
        title: selectedFile.name,
        category,
        securityLevel,
        tags: [],
        uploadedBy: currentUser.name || currentUser.email || 'Unknown',
        uploadedAt: new Date(),
        fileUrl,
        fileName,
        fileType: selectedFile.type,
        viewCount: 0
      };

      await addDoc(collection(db, 'knowledge_base'), docData);

      alert('✅ アップロード完了！');

      setSelectedFile(null);
      setCategory('');
      setSecurityLevel(1);

      loadDocuments();

    } catch (error) {
      console.error('アップロードエラー:', error);
      alert('❌ アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const logDocumentAccess = async (document: Document) => {
    try {
      let userName = auth.currentUser?.displayName || '';

      if (!userName && auth.currentUser?.uid) {
        const userDoc = await getDoc(firestoreDoc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          userName = userDoc.data().name || '';
        }
      }

      await addDoc(collection(db, 'access_logs'), {
        documentId: document.id,
        documentTitle: document.title,
        documentCategory: document.category,
        securityLevel: document.securityLevel,
        userId: auth.currentUser?.uid,
        userName: userName,
        userEmail: auth.currentUser?.email,
        accessedAt: new Date(),
        accessType: 'view'
      });
      console.log('アクセスログ記録:', document.title, 'by', userName);
    } catch (error) {
      console.error('アクセスログ記録エラー:', error);
    }
  };

  const handleDocumentClick = async (doc: Document) => {
    try {
      const docRef = firestoreDoc(db, 'knowledge_base', doc.id);
      await updateDoc(docRef, {
        viewCount: (doc.viewCount || 0) + 1
      });
      window.open(doc.fileUrl, '_blank');
      logDocumentAccess(doc);
    } catch (error) {
      console.error('文書オープンエラー:', error);
    }
  };

  const handleOpenDocument = async (document: Document, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      console.log('文書を開く:', document.title);
      await logDocumentOpen(document);
      window.open(document.fileUrl, '_blank');
      console.log('文書を開きました:', document.title);
    } catch (error) {
      console.error('文書を開くエラー:', error);
      alert('文書を開くことができませんでした');
    }
  };

  const logDocumentOpen = async (document: Document) => {
    try {
      let userName = auth.currentUser?.displayName || '';
      if (!userName && auth.currentUser?.uid) {
        const userDoc = await getDoc(firestoreDoc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          userName = userDoc.data().name || '';
        }
      }
      await addDoc(collection(db, 'access_logs'), {
        documentId: document.id,
        documentTitle: document.title,
        documentCategory: document.category,
        securityLevel: document.securityLevel,
        userId: auth.currentUser?.uid,
        userName: userName,
        userEmail: auth.currentUser?.email,
        accessedAt: new Date(),
        accessType: 'open'
      });
      console.log('文書オープンログ記録:', document.title, 'by', userName);
    } catch (error) {
      console.error('オープンログ記録エラー:', error);
    }
  };

  const handleDeleteClick = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation(); // 文書クリックイベントの伝播を防ぐ
    console.log('Edit document:', doc);
    setDocumentToEdit(doc);
    setEditedTitle(doc.title);
    setEditedCategory(doc.category);
    setEditedTags(doc.tags || []);
    setEditedSecurityLevel(doc.securityLevel);
    setEditDialogOpen(true);
  };

  // 実際の編集保存処理
  const handleSaveEdit = async () => {
    console.log('=== 編集保存処理開始 ===');
    console.log('documentToEdit:', documentToEdit);

    if (!documentToEdit) {
      console.log('エラー: documentToEdit が null です');
      return;
    }

    try {
      console.log('Step 1: Firestoreに保存開始');

      const updateData = {
        title: editedTitle,
        category: editedCategory,
        tags: editedTags,
        securityLevel: editedSecurityLevel,
        lastEditedAt: new Date(),
        lastEditedBy: auth.currentUser?.uid,
        lastEditedByName: auth.currentUser?.displayName
      };

      console.log('保存データ:', updateData);

      // Firestoreを更新
      await updateDoc(firestoreDoc(db, 'knowledge_base', documentToEdit.id), updateData);
      console.log('Step 1完了: Firestore更新成功');

      console.log('Step 2: 編集履歴記録開始');

      // 編集履歴を記録
      await addDoc(collection(db, 'edit_logs'), {
        documentId: documentToEdit.id,
        documentTitle: documentToEdit.title,
        editedBy: auth.currentUser?.uid,
        editedByName: auth.currentUser?.displayName,
        editedAt: new Date(),
        changes: {
          title: { before: documentToEdit.title, after: editedTitle },
          category: { before: documentToEdit.category, after: editedCategory },
          tags: { before: documentToEdit.tags || [], after: editedTags },
          securityLevel: { before: documentToEdit.securityLevel, after: editedSecurityLevel }
        }
      });
      console.log('Step 2完了: 編集履歴記録成功');

      alert('編集を保存しました');
      setEditDialogOpen(false);
      setDocumentToEdit(null);

      console.log('Step 3: リスト再読み込み');
      // リストを再読み込み
      loadDocuments();
      console.log('=== 編集保存処理完了 ===');

    } catch (error) {
      console.error('=== 編集保存エラー ===');
      console.error('エラー詳細:', error);
      console.error('エラーメッセージ:', (error as Error).message);
      alert('編集の保存に失敗しました: ' + (error as Error).message);
    }
  };

  const handleDeleteDocument = async () => {
    console.log('=== 削除処理開始 ===');
    console.log('documentToDelete:', documentToDelete);

    if (!documentToDelete) {
      console.log('エラー: documentToDelete が null です');
      return;
    }

    try {
      console.log('Step 1: Storageから削除開始');
      console.log('fileUrl:', documentToDelete.fileUrl);

      // 1. Firebase Storageから削除
      const storageRef = ref(storage, documentToDelete.fileUrl);
      await deleteObject(storageRef);
      console.log('Step 1完了: Storage削除成功');

      console.log('Step 2: Firestoreから削除開始');
      console.log('documentId:', documentToDelete.id);

      // 2. Firestoreから削除
      await deleteDoc(firestoreDoc(db, 'knowledge_base', documentToDelete.id));
      console.log('Step 2完了: Firestore削除成功');

      console.log('Step 3: 削除ログ記録開始');

      // 3. 削除ログを記録
      await addDoc(collection(db, 'deletion_logs'), {
        documentId: documentToDelete.id,
        documentTitle: documentToDelete.title,
        deletedBy: auth.currentUser?.uid,
        deletedByName: auth.currentUser?.displayName,
        deletedAt: new Date(),
        originalUploader: documentToDelete.uploadedBy,
        fileUrl: documentToDelete.fileUrl,
        category: documentToDelete.category,
        securityLevel: documentToDelete.securityLevel
      });
      console.log('Step 3完了: ログ記録成功');

      alert('削除しました');
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);

      console.log('Step 4: リスト再読み込み');
      // リストを再読み込み
      loadDocuments();
      console.log('=== 削除処理完了 ===');

    } catch (error) {
      console.error('=== 削除エラー ===');
      console.error('エラー詳細:', error);
      console.error('エラーメッセージ:', (error as Error).message);
      console.error('エラースタック:', (error as Error).stack);
      alert('削除に失敗しました: ' + (error as Error).message);
    }
  };

  const toggleFavorite = async (documentId: string) => {
    if (!auth.currentUser) return;

    try {
      const newFavorites = favorites.includes(documentId)
        ? favorites.filter(id => id !== documentId)
        : [...favorites, documentId];

      await setDoc(firestoreDoc(db, 'user_favorites', auth.currentUser.uid), {
        userId: auth.currentUser.uid,
        documentIds: newFavorites,
        updatedAt: new Date()
      });

      setFavorites(newFavorites);
      console.log('お気に入り更新:', documentId);
    } catch (error) {
      console.error('お気に入り更新エラー:', error);
    }
  };

  const hasViewPermission = (doc: Document): boolean => {
    const userPermissionLevel = getUserAccessLevel(currentUser);
    if (userPermissionLevel >= 3) return true;
    if (userPermissionLevel >= 2) return doc.securityLevel <= 2;
    if (userPermissionLevel >= 1) return doc.securityLevel <= 1;
    return doc.securityLevel === 0;
  };

  const filteredDocuments = documents.filter(doc => {
    // 権限チェック
    if (!hasViewPermission(doc)) return false;

    // カテゴリーフィルター
    if (selectedCategory && selectedCategory !== 'all') {
      if (doc.category !== selectedCategory) return false;
    }

    // 検索カテゴリーフィルター（詳細検索）
    if (searchCategory !== 'all') {
      if (doc.category !== searchCategory) return false;
    }

    // タグフィルター
    if (searchTags.length > 0) {
      const docTags = doc.tags || [];
      const hasAllTags = searchTags.every(searchTag =>
        docTags.some(docTag => docTag.toLowerCase().includes(searchTag.toLowerCase()))
      );
      if (!hasAllTags) return false;
    }

    // テキスト検索
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const titleMatch = doc.title.toLowerCase().includes(query);
      const tagsMatch = doc.tags?.some(tag => tag.toLowerCase().includes(query));
      const categoryMatch = doc.category?.toLowerCase().includes(query);
      return titleMatch || tagsMatch || categoryMatch;
    }

    return true;
  });

  const displayCategories = availableCategories.length > 0 ? availableCategories : categories;

  const categoryCounts = displayCategories.reduce((acc, cat) => {
    const catValue = availableCategories.length > 0 ? cat.value : cat.id;
    acc[catValue] = documents.filter(d => d.category === catValue).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📚 ナレッジベース</h1>
        </div>

        {currentUser?.role === 'owner_executive' || currentUser?.role === 'admin' ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">文書アップロード</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ファイル選択
                </label>
                <input
                  type="file"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none p-2"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png"
                />
                {selectedFile && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    選択: {selectedFile.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  カテゴリ
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">選択してください</option>
                  {availableCategories.length > 0 ? (
                    availableCategories.map(cat => (
                      <option key={cat.id} value={cat.value}>
                        {cat.icon} {cat.name}
                      </option>
                    ))
                  ) : (
                    categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  機密レベル
                </label>
                <div className="flex flex-wrap gap-4">
                  {[0, 1, 2, 3].map(level => (
                    <label key={level} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="securityLevel"
                        value={level}
                        checked={securityLevel === level}
                        onChange={(e) => setSecurityLevel(parseInt(e.target.value) as 0 | 1 | 2 | 3)}
                        className="w-4 h-4"
                      />
                      <span className={`px-2 py-1 rounded text-xs font-medium ${securityLevelColors[level as 0 | 1 | 2 | 3]}`}>
                        {level}: {securityLevelNames[level as 0 | 1 | 2 | 3]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {uploading ? 'アップロード中...' : 'アップロード'}
              </button>
            </div>
          </div>
        ) : null}

        {/* お気に入りセクション */}
        {favorites.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500 fill-current" />
              お気に入り
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents
                .filter(doc => favorites.includes(doc.id) && hasViewPermission(doc))
                .map(doc => (
                  <div
                    key={doc.id}
                    onClick={() => handleDocumentClick(doc)}
                    className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-teal-500 dark:hover:border-teal-500 cursor-pointer transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-sm flex-1">{doc.title}</h3>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(doc.id);
                          }}
                          className="p-1 text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded"
                        >
                          <Star className="w-4 h-4 fill-current" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className={`px-2 py-0.5 rounded ${
                        doc.securityLevel === 0 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        doc.securityLevel === 1 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                        doc.securityLevel === 2 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {doc.securityLevel === 0 ? '公開' :
                         doc.securityLevel === 1 ? '社内限定' :
                         doc.securityLevel === 2 ? '機密' : '極秘'}
                      </span>
                      <span>👁 {doc.viewCount || 0}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 最近閲覧セクション */}
        {recentDocuments.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              最近閲覧した文書
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentDocuments.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => handleDocumentClick(doc)}
                  className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-sm flex-1">{doc.title}</h3>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(doc.id);
                        }}
                        className={`p-1 rounded ${
                          favorites.includes(doc.id)
                            ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                            : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        {favorites.includes(doc.id) ? (
                          <Star className="w-4 h-4 fill-current" />
                        ) : (
                          <Star className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className={`px-2 py-0.5 rounded ${
                      doc.securityLevel === 0 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                      doc.securityLevel === 1 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                      doc.securityLevel === 2 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {doc.securityLevel === 0 ? '公開' :
                       doc.securityLevel === 1 ? '社内限定' :
                       doc.securityLevel === 2 ? '機密' : '極秘'}
                    </span>
                    <span>👁 {doc.viewCount || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">📂 カテゴリ別</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`p-4 rounded-lg border-2 transition ${
                selectedCategory === 'all'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <FileText className="w-8 h-8 mx-auto mb-2 text-gray-600 dark:text-gray-400" />
              <div className="font-medium text-gray-900 dark:text-white">全て</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{documents.length}件</div>
            </button>

            {availableCategories.length > 0 ? (
              availableCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`p-4 rounded-lg border-2 transition ${
                    selectedCategory === cat.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="text-3xl mb-2">{cat.icon}</div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">{cat.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{categoryCounts[cat.value] || 0}件</div>
                </button>
              ))
            ) : (
              categories.map(cat => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`p-4 rounded-lg border-2 transition ${
                      selectedCategory === cat.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <Icon className="w-8 h-8 mx-auto mb-2 text-gray-600 dark:text-gray-400" />
                    <div className="font-medium text-sm text-gray-900 dark:text-white">{cat.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{categoryCounts[cat.id] || 0}件</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="文書を検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* 詳細検索フィルター */}
          <div className="flex flex-wrap gap-3 mt-3">
            {/* カテゴリー選択 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">カテゴリ:</span>
              <select
                value={searchCategory}
                onChange={(e) => setSearchCategory(e.target.value)}
                className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              >
                <option value="all">すべて</option>
                {availableCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* タグ入力 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">タグ:</span>
              <input
                type="text"
                placeholder="タグで絞り込み（カンマ区切り）"
                onChange={(e) => {
                  const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                  setSearchTags(tags);
                }}
                className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm w-64"
              />
            </div>

            {/* 検索クリアボタン */}
            {(searchQuery || searchCategory !== 'all' || searchTags.length > 0) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchCategory('all');
                  setSearchTags([]);
                  const tagInput = document.querySelector('input[placeholder*="タグ"]') as HTMLInputElement;
                  if (tagInput) tagInput.value = '';
                }}
                className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
              >
                クリア
              </button>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">📄 文書一覧</h2>
          {loading ? (
            <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
          ) : filteredDocuments.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">文書がありません</p>
          ) : (
            <div className="space-y-2">
              {filteredDocuments.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
                  onClick={() => handleDocumentClick(doc)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">{doc.title}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${securityLevelColors[doc.securityLevel]}`}>
                        {securityLevelNames[doc.securityLevel]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      アップロード: {doc.uploadedBy} | {doc.uploadedAt?.toDate ? doc.uploadedAt.toDate().toLocaleDateString('ja-JP') : '不明'}
                      {doc.viewCount > 0 && ` | 閲覧: ${doc.viewCount}回`}
                    </p>
                  </div>
                  {/* 開くボタン */}
                  <button
                    onClick={(e) => handleOpenDocument(doc, e)}
                    className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="新しいタブで開く"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  {/* お気に入りボタン */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(doc.id);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      favorites.includes(doc.id)
                        ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                        : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    title={favorites.includes(doc.id) ? 'お気に入り解除' : 'お気に入り登録'}
                  >
                    {favorites.includes(doc.id) ? (
                      <Star className="w-4 h-4 fill-current" />
                    ) : (
                      <Star className="w-4 h-4" />
                    )}
                  </button>
                  {/* 編集ボタン（権限がある場合のみ表示） */}
                  {currentUser?.canEditKnowledge && (
                    <button
                      onClick={(e) => handleEditClick(doc, e)}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      title="編集"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  {/* 削除ボタン（権限がある場合のみ表示） */}
                  {currentUser?.canDeleteKnowledge && (
                    <button
                      onClick={(e) => handleDeleteClick(doc, e)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <FileText className="w-5 h-5 text-gray-400" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                文書を削除しますか？
              </h3>

              {documentToDelete && (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <div className="font-semibold text-gray-900 dark:text-white mb-2">
                      {documentToDelete.title}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      カテゴリ: {availableCategories.find(c => c.value === documentToDelete.category)?.name || categories.find(c => c.id === documentToDelete.category)?.name || documentToDelete.category}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      アップロード: {documentToDelete.uploadedBy} ({new Date(documentToDelete.uploadedAt.seconds * 1000).toLocaleDateString('ja-JP')})
                    </div>
                  </div>

                  <div className="text-red-600 dark:text-red-400 font-semibold">
                    この操作は取り消せません。本当に削除しますか？
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-end gap-3 rounded-b-lg">
              <button
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDocumentToDelete(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteDocument}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 編集ダイアログ */}
      {editDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                文書を編集
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                文書の情報を編集できます。変更内容は編集履歴に記録されます。
              </p>

              <div className="space-y-4">
                {/* ファイル名 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ファイル名
                  </label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="ファイル名を入力"
                  />
                </div>

                {/* カテゴリ */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    カテゴリ
                  </label>
                  <select
                    value={editedCategory}
                    onChange={(e) => setEditedCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {availableCategories.length > 0 ? (
                      availableCategories.map(cat => (
                        <option key={cat.id} value={cat.value}>
                          {cat.icon} {cat.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="manual">運航マニュアル</option>
                        <option value="training">研修資料</option>
                        <option value="policy">経理・給与</option>
                        <option value="minutes">規則・規定</option>
                        <option value="maintenance">メンテナンス</option>
                        <option value="other">その他</option>
                      </>
                    )}
                  </select>
                </div>

                {/* タグ */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    タグ（カンマ区切り）
                  </label>
                  <input
                    type="text"
                    value={editedTags.join(', ')}
                    onChange={(e) => setEditedTags(e.target.value.split(',').map(t => t.trim()).filter(t => t))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="例: 安全, マニュアル, 重要"
                  />
                </div>

                {/* 機密レベル（管理者・オーナーのみ） */}
                {(currentUser?.role === 'admin' || currentUser?.role === 'owner_executive') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      機密レベル
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditedSecurityLevel(0)}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          editedSecurityLevel === 0
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        0: 公開
                      </button>
                      <button
                        onClick={() => setEditedSecurityLevel(1)}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          editedSecurityLevel === 1
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        1: 社内限定
                      </button>
                      <button
                        onClick={() => setEditedSecurityLevel(2)}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          editedSecurityLevel === 2
                            ? 'bg-yellow-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        2: 機密
                      </button>
                      <button
                        onClick={() => setEditedSecurityLevel(3)}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          editedSecurityLevel === 3
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        3: 極秘
                      </button>
                    </div>
                  </div>
                )}

                {/* 元の情報表示 */}
                {documentToEdit && (
                  <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <div className="font-semibold text-gray-900 dark:text-white mb-2">
                      元の情報
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <div>アップロード: {documentToEdit.uploadedBy}</div>
                      <div>日時: {new Date(documentToEdit.uploadedAt.seconds * 1000).toLocaleString('ja-JP')}</div>
                      {documentToEdit.viewCount > 0 && (
                        <div>閲覧数: {documentToEdit.viewCount}回</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-end gap-3 rounded-b-lg">
              <button
                onClick={() => {
                  setEditDialogOpen(false);
                  setDocumentToEdit(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
