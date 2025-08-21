import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const App = () => {
  // --- Состояния ---
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentPage, setCurrentPage] = useState('login');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [friends, setFriends] = useState([]);
  const [newFriend, setNewFriend] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [schedule, setSchedule] = useState([]);
  const [noteRequest, setNoteRequest] = useState({ studentName: '', lesson: '', topic: '' });
  const [currentLesson, setCurrentLesson] = useState(null);

  // --- Расписание (локальный fallback) ---
  const defaultSchedule = [
    { day: 'Понедельник', lessons: [
      { time: '08:00-08:45', subject: 'Математика' },
      { time: '08:45-09:00', subject: 'Перерыв' },
      { time: '09:00-09:45', subject: 'Физика' },
    ]},
    { day: 'Вторник', lessons: [
      { time: '08:00-08:45', subject: 'Литература' },
      { time: '08:45-09:00', subject: 'Перерыв' },
      { time: '09:00-09:45', subject: 'История' },
    ]},
    // Добавь другие дни
  ];

  // --- Инициализация Firebase ---
  useEffect(() => {
    const firebaseConfig = typeof firebase_config !== 'undefined' ? JSON.parse(firebase_config) : {};
    const initialAuthToken = typeof initial_auth_token !== 'undefined' ? initial_auth_token : null;

    if (!Object.keys(firebaseConfig).length) {
      console.error('Firebase config is missing!');
      setSchedule(defaultSchedule);
      setIsAuthReady(true);
      return;
    }

    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authentication = getAuth(app);
      setDb(firestore);
      setAuth(authentication);

      const unsubscribe = onAuthStateChanged(authentication, async (user) => {
        if (user) {
          setUserId(user.uid);
          setUsername(user.displayName || 'Аноним');
        } else if (initialAuthToken) {
          try {
            await signInWithCustomToken(authentication, initialAuthToken);
          } catch (error) {
            console.error('Custom token sign-in failed:', error);
            await signInAnonymously(authentication);
          }
        } else {
          await signInAnonymously(authentication);
        }
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Firebase init failed:', error);
      setSchedule(defaultSchedule);
      setIsAuthReady(true);
    }
  }, []);

  // --- Загрузка данных (сообщения, друзья, объявления, расписание) ---
  useEffect(() => {
    if (db && userId) {
      // Глобальный чат
      const messagesQuery = query(
        collection(db, `artifacts/${app_id}/public/data/chat_messages`),
        orderBy('timestamp', 'desc')
      );
      const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        const chatMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setMessages(chatMessages);
      }, (error) => console.error('Firestore messages error:', error));

      // Друзья
      const friendsQuery = query(
        collection(db, `artifacts/${app_id}/public/data/friends`),
        where('userId', '==', userId)
      );
      const unsubscribeFriends = onSnapshot(friendsQuery, (snapshot) => {
        const friendList = snapshot.docs.map((doc) => doc.data().friendUsername);
        setFriends(friendList);
      }, (error) => console.error('Firestore friends error:', error));

      // Объявления
      const announcementsQuery = query(
        collection(db, `artifacts/${app_id}/public/data/announcements`),
        orderBy('timestamp', 'desc')
      );
      const unsubscribeAnnouncements = onSnapshot(announcementsQuery, (snapshot) => {
        const announcementList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAnnouncements(announcementList);
      }, (error) => console.error('Firestore announcements error:', error));

      // Расписание
      const scheduleQuery = query(collection(db, `artifacts/${app_id}/public/data/schedule`));
      const unsubscribeSchedule = onSnapshot(scheduleQuery, (snapshot) => {
        const scheduleData = snapshot.docs.map((doc) => doc.data());
        setSchedule(scheduleData.length ? scheduleData : defaultSchedule);
      }, (error) => {
        console.error('Firestore schedule error:', error);
        setSchedule(defaultSchedule);
      });

      return () => {
        unsubscribeMessages();
        unsubscribeFriends();
        unsubscribeAnnouncements();
        unsubscribeSchedule();
      };
    }
  }, [db, userId]);

  // --- Реал-тайм расписание ---
  useEffect(() => {
    const updateSchedule = () => {
      const now = new Date();
      const day = now.toLocaleDateString('ru-RU', { weekday: 'long' });
      const currentTime = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      const today = schedule.find((d) => d.day === day);
      if (today) {
        const currentLesson = today.lessons.find(
          (l) => currentTime >= l.time.split('-')[0] && currentTime < l.time.split('-')[1]
        );
        const nextLesson = today.lessons.find((l) => currentTime < l.time.split('-')[0]);
        setCurrentLesson(
          currentLesson
            ? `Текущий урок: ${currentLesson.subject} (${currentLesson.time})`
            : nextLesson
            ? `Следующий урок: ${nextLesson.subject} в ${nextLesson.time}`
            : 'День окончен!'
        );
      } else {
        setCurrentLesson('Сегодня нет уроков');
      }
    };

    updateSchedule();
    const interval = setInterval(updateSchedule, 60000); // Обновление каждую минуту
    return () => clearInterval(interval);
  }, [schedule]);

  // --- Регистрация ---
  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert('Пароли не совпадают!');
      return;
    }
    try {
      const usersCollection = collection(db, `artifacts/${app_id}/public/data/users`);
      const q = query(usersCollection, where('username', '==', username));
      const userSnapshot = await getDocs(q);
      if (!userSnapshot.empty) {
        alert('Пользователь с таким именем уже существует.');
        return;
      }

      await addDoc(usersCollection, {
        username,
        password, // В реале нужен хэш через Firebase Functions
        createdAt: serverTimestamp(),
      });
      await updateProfile(auth.currentUser, { displayName: username });
      alert('Регистрация успешна! Войдите в аккаунт.');
      setCurrentPage('login');
    } catch (error) {
      console.error('Registration error:', error);
      alert('Ошибка регистрации. Попробуйте снова.');
    }
  };

  // --- Вход ---
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const usersCollection = collection(db, `artifacts/${app_id}/public/data/users`);
      const q = query(usersCollection, where('username', '==', username), where('password', '==', password));
      const userSnapshot = await getDocs(q);

      if (!userSnapshot.empty) {
        setUserId(userSnapshot.docs[0].id);
        await updateProfile(auth.currentUser, { displayName: username });
        setCurrentPage('main');
      } else {
        alert('Неверное имя или пароль.');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Ошибка входа. Попробуйте снова.');
    }
  };

  // --- Отправка сообщения ---
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;

    try {
      await addDoc(collection(db, `artifacts/${app_id}/public/data/chat_messages`), {
        text: newMessage,
        username,
        userId,
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      console.error('Send message error:', error);
      alert('Ошибка отправки сообщения.');
    }
  };

  // --- Добавление друга ---
  const handleAddFriend = async (e) => {
    e.preventDefault();
    if (newFriend.trim() === '') return;

    try {
      const usersCollection = collection(db, `artifacts/${app_id}/public/data/users`);
      const q = query(usersCollection, where('username', '==', newFriend));
      const userSnapshot = await getDocs(q);
      if (userSnapshot.empty) {
        alert('Пользователь не найден.');
        return;
      }

      await addDoc(collection(db, `artifacts/${app_id}/public/data/friends`), {
        userId,
        friendUsername: newFriend,
        addedAt: serverTimestamp(),
      });
      setNewFriend('');
    } catch (error) {
      console.error('Add friend error:', error);
      alert('Ошибка добавления друга.');
    }
  };

  // --- Добавление объявления ---
  const handleAddAnnouncement = async (e) => {
    e.preventDefault();
    if (newAnnouncement.trim() === '') return;

    try {
      await addDoc(collection(db, `artifacts/${app_id}/public/data/announcements`), {
        text: newAnnouncement,
        username,
        userId,
        timestamp: serverTimestamp(),
      });
      setNewAnnouncement('');
    } catch (error) {
      console.error('Add announcement error:', error);
      alert('Ошибка добавления объявления.');
    }
  };

  // --- Запрос конспекта ---
  const handleNoteRequest = async (e) => {
    e.preventDefault();
    if (!noteRequest.studentName || !noteRequest.lesson) {
      alert('Заполните имя и урок!');
      return;
    }

    try {
      await addDoc(collection(db, `artifacts/${app_id}/public/data/note_requests`), {
        studentName: noteRequest.studentName,
        lesson: noteRequest.lesson,
        topic: noteRequest.topic || 'Не указано',
        userId,
        timestamp: serverTimestamp(),
      });
      alert('Запрос отправлен! Ожидайте конспект.');
      setNoteRequest({ studentName: '', lesson: '', topic: '' });
    } catch (error) {
      console.error('Note request error:', error);
      alert('Ошибка отправки запроса.');
    }
  };

  // --- Переключение темы ---
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // --- Рендеринг ---
  const renderContent = () => {
    switch (currentPage) {
      case 'login':
        return (
          <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-blue-100 to-gray-100">
            <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-sm text-center">
              <h1 className="text-3xl font-bold mb-6 text-gray-900">Вход</h1>
              <form onSubmit={handleLogin} className="space-y-4">
                <input
                  type="text"
                  placeholder="Имя пользователя"
                  className="w-full px-4 py-3 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <input
                  type="password"
                  placeholder="Пароль"
                  className="w-full px-4 py-3 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all">
                  Войти
                </button>
              </form>
              <p className="mt-4 text-gray-600">
                Нет аккаунта?{' '}
                <a href="#" onClick={() => setCurrentPage('register')} className="text-blue-500 hover:underline">
                  Зарегистрироваться
                </a>
              </p>
            </div>
          </div>
        );
      case 'register':
        return (
          <div className="flex items-center justify-center min-h-screen bg-gradient-to-r from-blue-100 to-gray-100">
            <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-sm text-center">
              <h1 className="text-3xl font-bold mb-6 text-gray-900">Регистрация</h1>
              <form onSubmit={handleRegister} className="space-y-4">
                <input
                  type="text"
                  placeholder="Имя пользователя"
                  className="w-full px-4 py-3 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <input
                  type="password"
                  placeholder="Пароль"
                  className="w-full px-4 py-3 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <input
                  type="password"
                  placeholder="Подтвердить пароль"
                  className="w-full px-4 py-3 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all">
                  Зарегистрироваться
                </button>
              </form>
              <p className="mt-4 text-gray-600">
                Уже есть аккаунт?{' '}
                <a href="#" onClick={() => setCurrentPage('login')} className="text-blue-500 hover:underline">
                  Войти
                </a>
              </p>
            </div>
          </div>
        );
      case 'main':
        if (!isAuthReady) {
          return (
            <div className="flex items-center justify-center min-h-screen text-gray-600">Загрузка...</div>
          );
        }
        return (
          <div className={`min-h-screen p-4 bg-gradient-to-r ${theme === 'dark' ? 'from-gray-800 to-gray-900' : 'from-blue-100 to-gray-100'}`}>
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-[250px_1fr] gap-4">
              {/* Sidebar */}
              <aside className="bg-white rounded-xl shadow-lg p-6 flex flex-col items-center">
                <h2 className="text-2xl font-bold mb-6 text-gray-900">SchoolHub</h2>
                <nav className="w-full">
                  <ul className="space-y-2">
                    <li>
                      <button
                        onClick={() => setCurrentPage('global-chat')}
                        className="w-full text-left p-4 rounded-lg hover:bg-blue-100 text-gray-800 transition-all"
                      >
                        Глобальный чат 💬
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setCurrentPage('private-chat')}
                        className="w-full text-left p-4 rounded-lg hover:bg-blue-100 text-gray-800 transition-all"
                      >
                        Личные сообщения 🤫
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setCurrentPage('friends-list')}
                        className="w-full text-left p-4 rounded-lg hover:bg-blue-100 text-gray-800 transition-all"
                      >
                        Друзья ⭐
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setCurrentPage('announcements')}
                        className="w-full text-left p-4 rounded-lg hover:bg-blue-100 text-gray-800 transition-all"
                      >
                        Объявления 📢
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setCurrentPage('notes-request')}
                        className="w-full text-left p-4 rounded-lg hover:bg-blue-100 text-gray-800 transition-all"
                      >
                        Запросить конспект 📝
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => setCurrentPage('settings')}
                        className="w-full text-left p-4 rounded-lg hover:bg-blue-100 text-gray-800 transition-all"
                      >
                        Настройки ⚙️
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          auth.signOut();
                          setCurrentPage('login');
                        }}
                        className="w-full text-left p-4 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all mt-4"
                      >
                        Выйти ➡️
                      </button>
                    </li>
                  </ul>
                </nav>
                <div className="mt-8 text-center text-sm text-gray-500">
                  <p className="font-bold mb-1">Твой ID:</p>
                  <code className="bg-gray-200 p-2 rounded-md">{userId || 'N/A'}</code>
                </div>
              </aside>
              {/* Main Content */}
              <main className="bg-white rounded-xl shadow-lg p-6">
                <div className="mb-4 p-4 bg-blue-50 rounded-lg text-center text-lg font-semibold text-blue-800">
                  {currentLesson || 'Загрузка расписания...'}
                </div>
                {renderMainContent()}
              </main>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderMainContent = () => {
    switch (currentPage) {
      case 'global-chat':
        return (
          <div>
            <h2 className="text-3xl font-bold mb-4 text-gray-900">Глобальный чат</h2>
            <div className="flex flex-col h-[60vh]">
              <div className="flex-1 overflow-y-auto space-y-4 p-4 border rounded-lg bg-gray-50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-xl max-w-[75%] ${msg.userId === userId ? 'bg-blue-500 text-white ml-auto' : 'bg-gray-200 text-gray-800 mr-auto'}`}
                  >
                    <p className="font-semibold">{msg.username}</p>
                    <p>{msg.text}</p>
                    <p className="text-xs opacity-70">{new Date(msg.timestamp?.seconds * 1000).toLocaleTimeString()}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} className="flex gap-2 mt-4">
                <input
                  type="text"
                  placeholder="Написать сообщение..."
                  className="flex-1 p-3 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-lg transition-all">
                  Отправить
                </button>
              </form>
            </div>
          </div>
        );
      case 'private-chat':
        return (
          <div>
            <h2 className="text-3xl font-bold mb-4 text-gray-900">Личные сообщения</h2>
            <p className="text-gray-600">Выберите друга для чата:</p>
            <ul className="space-y-2">
              {friends.map((friend, index) => (
                <li key={index} className="p-2 bg-gray-100 rounded-lg">
                  {friend}
                </li>
              ))}
            </ul>
            <p className="text-gray-600 mt-4">Личные сообщения будут добавлены в следующем обновлении!</p>
          </div>
        );
      case 'friends-list':
        return (
          <div>
            <h2 className="text-3xl font-bold mb-4 text-gray-900">Друзья</h2>
            <form onSubmit={handleAddFriend} className="mb-4 flex gap-2">
              <input
                type="text"
                placeholder="Имя друга"
                className="flex-1 p-3 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newFriend}
                onChange={(e) => setNewFriend(e.target.value)}
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-lg transition-all">
                Добавить
              </button>
            </form>
            <ul className="space-y-2">
              {friends.map((friend, index) => (
                <li key={index} className="p-2 bg-gray-100 rounded-lg flex justify-between">
                  <span>{friend}</span>
                  <button
                    onClick={async () => {
                      const q = query(
                        collection(db, `artifacts/${app_id}/public/data/friends`),
                        where('userId', '==', userId),
                        where('friendUsername', '==', friend)
                      );
                      const snapshot = await getDocs(q);
                      snapshot.forEach((doc) => doc.ref.delete());
                    }}
                    className="text-red-500 hover:underline"
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      case 'announcements':
        return (
          <div>
            <h2 className="text-3xl font-bold mb-4 text-gray-900">Объявления</h2>
            <form onSubmit={handleAddAnnouncement} className="mb-4 flex gap-2">
              <input
                type="text"
                placeholder="Новое объявление..."
                className="flex-1 p-3 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newAnnouncement}
                onChange={(e) => setNewAnnouncement(e.target.value)}
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-lg transition-all">
                Добавить
              </button>
            </form>
            <ul className="space-y-3">
              {announcements.map((ann) => (
                <li key={ann.id} className="bg-gray-100 p-4 rounded-lg shadow-sm">
                  <p>{ann.text}</p>
                  <p className="text-sm text-gray-500">От {ann.username} в {new Date(ann.timestamp?.seconds * 1000).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          </div>
        );
      case 'notes-request':
        return (
          <div>
            <h2 className="text-3xl font-bold mb-4 text-gray-900">Запросить конспект</h2>
            <form onSubmit={handleNoteRequest} className="space-y-4">
              <input
                type="text"
                placeholder="Ваше имя"
                className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={noteRequest.studentName}
                onChange={(e) => setNoteRequest({ ...noteRequest, studentName: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Урок (например, Математика)"
                className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={noteRequest.lesson}
                onChange={(e) => setNoteRequest({ ...noteRequest, lesson: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Тема урока (не обязательно)"
                className="w-full p-3 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={noteRequest.topic}
                onChange={(e) => setNoteRequest({ ...noteRequest, topic: e.target.value })}
              />
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all">
                Отправить запрос
              </button>
            </form>
          </div>
        );
      case 'settings':
        return (
          <div>
            <h2 className="text-3xl font-bold mb-4 text-gray-900">Настройки</h2>
            <div className="flex items-center space-x-2">
              <label htmlFor="theme-toggle" className="text-gray-800">Тёмная тема</label>
              <input
                type="checkbox"
                id="theme-toggle"
                checked={theme === 'dark'}
                onChange={toggleTheme}
                className="w-10 h-5 rounded-full bg-gray-300 checked:bg-blue-500"
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return <div className={theme === 'dark' ? 'dark' : ''}>{renderContent()}</div>;
};

export default App;