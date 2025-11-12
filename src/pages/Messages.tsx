import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, query, where, getDocs, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format } from 'date-fns';
import { Send, Clock, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { Message } from '../types';

export function Messages() {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const isAdmin = currentUser?.role === 'owner_executive' || currentUser?.role === 'admin';

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    try {
      const messagesRef = collection(db, 'messages');
      const q = query(
        messagesRef,
        where('participants', 'array-contains', currentUser?.uid),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);
      const convos = new Map();

      snapshot.forEach(doc => {
        const msg = { id: doc.id, ...doc.data() } as Message;
        if (!convos.has(msg.conversationId)) {
          convos.set(msg.conversationId, msg);
        }
      });

      setConversations(Array.from(convos.values()));
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const messagesRef = collection(db, 'messages');
      const q = query(
        messagesRef,
        where('conversationId', '==', conversationId),
        orderBy('timestamp', 'asc')
      );

      const snapshot = await getDocs(q);
      const data: Message[] = [];

      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as Message);
      });

      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;

    try {
      const conversationId = selectedConversation || `conv_${Date.now()}`;

      const message: Omit<Message, 'id'> = {
        conversationId,
        participants: [currentUser.uid, 'admin'],
        type: 'regular',
        content: newMessage,
        sender: currentUser.uid,
        timestamp: new Date().toISOString()
      };

      await addDoc(collection(db, 'messages'), message);
      setNewMessage('');
      await loadMessages(conversationId);

      if (!selectedConversation) {
        setSelectedConversation(conversationId);
        await loadConversations();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const sendClockRequest = async () => {
    if (!currentUser) return;

    try {
      const conversationId = `conv_${Date.now()}`;

      const message: Omit<Message, 'id'> = {
        conversationId,
        participants: [currentUser.uid, 'admin'],
        type: 'clock_request',
        content: '打刻リクエスト',
        sender: currentUser.uid,
        timestamp: new Date().toISOString(),
        requestData: {
          type: 'clock_in'
        }
      };

      await addDoc(collection(db, 'messages'), message);
      await loadConversations();
      alert('打刻リクエストを送信しました');
    } catch (error) {
      console.error('Error sending clock request:', error);
    }
  };

  const sendVacationRequest = async () => {
    if (!currentUser) return;

    try {
      const conversationId = `conv_${Date.now()}`;

      const message: Omit<Message, 'id'> = {
        conversationId,
        participants: [currentUser.uid, 'admin'],
        type: 'vacation_request',
        content: '休暇リクエスト',
        sender: currentUser.uid,
        timestamp: new Date().toISOString()
      };

      await addDoc(collection(db, 'messages'), message);
      await loadConversations();
      alert('休暇リクエストを送信しました');
    } catch (error) {
      console.error('Error sending vacation request:', error);
    }
  };

  const approveRequest = async (messageId: string) => {
    try {
      const docRef = doc(db, 'messages', messageId);
      await updateDoc(docRef, { approved: true });
      if (selectedConversation) {
        await loadMessages(selectedConversation);
      }
      alert('リクエストを承認しました');
    } catch (error) {
      console.error('Error approving request:', error);
    }
  };

  const rejectRequest = async (messageId: string) => {
    try {
      const docRef = doc(db, 'messages', messageId);
      await updateDoc(docRef, { approved: false });
      if (selectedConversation) {
        await loadMessages(selectedConversation);
      }
      alert('リクエストを却下しました');
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">メッセージ</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              会話リスト
            </h2>

            {!isAdmin && (
              <div className="space-y-2 mb-4">
                <button
                  onClick={sendClockRequest}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-lg"
                  style={{ minHeight: '44px' }}
                >
                  <Clock className="w-5 h-5" />
                  <span>打刻リクエスト</span>
                </button>
                <button
                  onClick={sendVacationRequest}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                  style={{ minHeight: '44px' }}
                >
                  <Calendar className="w-5 h-5" />
                  <span>休暇リクエスト</span>
                </button>
              </div>
            )}

            {conversations.length === 0 ? (
              <p className="text-center text-gray-600 dark:text-gray-400 py-4">
                会話がありません
              </p>
            ) : (
              <div className="space-y-2">
                {conversations.map(conv => (
                  <button
                    key={conv.conversationId}
                    onClick={() => setSelectedConversation(conv.conversationId)}
                    className={`w-full text-left p-4 rounded-lg transition-colors ${
                      selectedConversation === conv.conversationId
                        ? 'bg-teal-50 dark:bg-teal-900/20 border-2 border-teal-500'
                        : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                    style={{ minHeight: '60px' }}
                  >
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {conv.type === 'clock_request' ? '打刻リクエスト' :
                       conv.type === 'vacation_request' ? '休暇リクエスト' :
                       conv.content}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {format(new Date(conv.timestamp), 'MM/dd HH:mm')}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            {selectedConversation ? (
              <div className="flex flex-col h-[600px]">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  メッセージ
                </h2>

                <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === currentUser?.uid ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] p-4 rounded-lg ${
                        msg.sender === currentUser?.uid
                          ? 'bg-teal-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      }`}>
                        <p>{msg.content}</p>
                        <p className={`text-xs mt-2 ${
                          msg.sender === currentUser?.uid
                            ? 'text-teal-100'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {format(new Date(msg.timestamp), 'MM/dd HH:mm')}
                        </p>

                        {(msg.type === 'clock_request' || msg.type === 'vacation_request') &&
                         isAdmin &&
                         msg.approved === undefined && (
                          <div className="flex space-x-2 mt-3">
                            <button
                              onClick={() => approveRequest(msg.id)}
                              className="flex items-center space-x-1 px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>承認</span>
                            </button>
                            <button
                              onClick={() => rejectRequest(msg.id)}
                              className="flex items-center space-x-1 px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>却下</span>
                            </button>
                          </div>
                        )}

                        {msg.approved !== undefined && (
                          <p className={`text-xs mt-2 font-medium ${
                            msg.approved ? 'text-green-200' : 'text-red-200'
                          }`}>
                            {msg.approved ? '✓ 承認済み' : '✗ 却下'}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="メッセージを入力..."
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    style={{ minHeight: '44px' }}
                  />
                  <button
                    onClick={sendMessage}
                    className="px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-lg"
                    style={{ minHeight: '44px' }}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                会話を選択してください
              </p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
