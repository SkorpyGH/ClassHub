import { classSchedule, announcements, subjects, noteRequests, users } from './data.js';

// Константа администратора (можно переопределить через localStorage.adminUsername)
const ADMIN_USERNAME = localStorage.getItem('adminUsername') || 'admin';

// Звук уведомлений
const bellAudio = new Audio('data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAA...'); // короткий пустой звук-заглушка; заменить при необходимости

function playBell() {
	try { bellAudio.currentTime = 0; bellAudio.play(); } catch (_) {}
}

// Notification API
async function requestNotificationPermission() {
	if (!('Notification' in window)) return false;
	if (Notification.permission === 'granted') return true;
	if (Notification.permission !== 'denied') {
		const res = await Notification.requestPermission();
		return res === 'granted';
	}
	return false;
}
function notify(title, body) {
	if (!('Notification' in window)) return;
	if (Notification.permission === 'granted') new Notification(title, { body });
}

// Показ уведомления
function showNotification(title, message, isError = false) {
	console.log(`Showing notification: ${title} - ${message}`);
	const modal = document.getElementById('notification-modal');
	const titleEl = document.getElementById('notification-title');
	const messageEl = document.getElementById('notification-message');
	if (modal && titleEl && messageEl) {
		titleEl.textContent = title;
		messageEl.textContent = message;
		modal.classList.remove('hidden');
		titleEl.classList.toggle('text-red-600', isError);
	}
}

const closeNotificationBtn = document.getElementById('close-notification-btn');
if (closeNotificationBtn) {
	closeNotificationBtn.addEventListener('click', () => {
		console.log('Closing notification modal');
		const modal = document.getElementById('notification-modal');
		if (modal) modal.classList.add('hidden');
	});
}

// Вспомогательные функции: онлайн/last seen
function getOnlineUsers() {
	return JSON.parse(localStorage.getItem('onlineUsers') || '{}');
}
function setOnlineUsers(map) {
	localStorage.setItem('onlineUsers', JSON.stringify(map));
}
function setUserOnline(username, isOnline) {
	if (!username) return;
	const map = getOnlineUsers();
	if (isOnline) {
		map[username] = true;
	} else {
		delete map[username];
	}
	setOnlineUsers(map);
}
function getLastSeenMap() {
	return JSON.parse(localStorage.getItem('lastSeenMap') || '{}');
}
function setLastSeen(username) {
	if (!username) return;
	const map = getLastSeenMap();
	map[username] = new Date().toISOString();
	localStorage.setItem('lastSeenMap', JSON.stringify(map));
}
function getLastSeen(username) {
	const map = getLastSeenMap();
	return map[username] || null;
}
function formatLastSeen(isoString) {
	if (!isoString) return 'неизвестно';
	const ts = new Date(isoString);
	const now = new Date();
	const diffMs = now - ts;
	const diffMin = Math.floor(diffMs / 60000);
	if (diffMin < 1) return 'только что';
	if (diffMin < 60) return `${diffMin} мин назад`;
	const diffH = Math.floor(diffMin / 60);
	if (diffH < 24) return `${diffH} ч назад`;
	const diffD = Math.floor(diffH / 24);
	if (diffD === 1) return 'вчера';
	return ts.toLocaleString('ru-RU');
}

// Показать/скрыть секции
function showSection(sectionId) {
	console.log(`Showing section: ${sectionId}`);
	document.querySelectorAll('.section').forEach((div) => div.classList.add('hidden'));
	const section = document.getElementById(sectionId);
	if (section) section.classList.remove('hidden');
	document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
	const link = document.getElementById(`${sectionId}-link`);
	if (link) link.classList.add('active');
}

// Реал-тайм расписание (мини-слайдер на основе таймингов школы)
const schoolTimeline = [
	{ num: 1, start: '08:30', end: '09:15' },
	{ num: 2, start: '09:25', end: '10:10' },
	{ num: 3, start: '10:20', end: '11:05' },
	{ num: 4, start: '11:20', end: '12:00' },
	{ num: 5, start: '12:20', end: '13:05' },
	{ num: 6, start: '13:05', end: '14:00' },
	{ num: 7, start: '14:10', end: '14:45' },
];

function getCurrentAndNextLessonByTime() {
	const now = new Date();
	const cur = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false });
	let current = null;
	let next = null;
	for (let i = 0; i < schoolTimeline.length; i++) {
		const l = schoolTimeline[i];
		if (cur >= l.start && cur < l.end) {
			current = l;
			next = schoolTimeline[i + 1] || null;
			break;
		}
		if (cur < l.start) {
			next = l;
			break;
		}
	}
	return { current, next };
}

function updateSchedule() {
	const now = new Date();
	const day = now.toLocaleDateString('ru-RU', { weekday: 'long' }).toLowerCase();
	const currentTime = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
	const lessons = classSchedule[day] || [];
	const currentLesson = lessons.find(
		(l) => currentTime >= l.time.split('-')[0] && currentTime < l.time.split('-')[1]
	);
	const nextLesson = lessons.find((l) => currentTime < l.time.split('-')[0]);
	const currentLessonDiv = document.getElementById('current-lesson');
	if (currentLessonDiv) {
		currentLessonDiv.textContent = currentLesson
			? `Текущий урок: ${currentLesson.subject} (${currentLesson.time})`
			: nextLesson
			? `Следующий урок: ${nextLesson.subject} в ${nextLesson.time}`
			: 'День окончен!';
	}
	// обновим слайдер
	const sliderText = document.getElementById('schedule-slide-text');
	if (sliderText) {
		const { current, next } = getCurrentAndNextLessonByTime();
		if (current) {
			sliderText.textContent = `Сейчас: ${current.num}-й урок (${current.start}–${current.end}). ${next ? `Далее: ${next.num}-й урок в ${next.start}.` : 'День близится к завершению.'}`;
		} else if (next) {
			sliderText.textContent = `Скоро ${next.num}-й урок: ${next.start}–${next.end}. Сейчас перерыв или до начала занятий.`;
		} else {
			sliderText.textContent = 'Уроки на сегодня завершены!';
		}
	}
}
setInterval(updateSchedule, 30000);
updateSchedule();

// Регистрация (доп. поля security)
const registerForm = document.getElementById('register-form');
if (registerForm) {
	console.log('Register form found');
	registerForm.addEventListener('submit', (e) => {
		e.preventDefault();
		console.log('Register form submitted');
		const usernameInput = document.getElementById('reg-username');
		const passwordInput = document.getElementById('reg-password');
		const confirmPasswordInput = document.getElementById('confirm-password');
		const secQ = document.getElementById('reg-sec-q');
		const secA = document.getElementById('reg-sec-a');
		const username = usernameInput.value.trim();
		const password = passwordInput.value;
		const confirmPassword = confirmPasswordInput.value;

		if (!username || !password || !confirmPassword || !secQ?.value || !secA?.value.trim()) {
			[usernameInput, passwordInput, confirmPasswordInput, secQ, secA].forEach(el => el?.classList.add('border-red-500'));
			showNotification('Ошибка', 'Заполните все поля!', true);
			return;
		}
		if (password !== confirmPassword) {
			passwordInput.classList.add('border-red-500');
			confirmPasswordInput.classList.add('border-red-500');
			showNotification('Ошибка', 'Пароли не совпадают!', true);
			return;
		}
		if (users.find((u) => u.username === username)) {
			usernameInput.classList.add('border-red-500');
			showNotification('Ошибка', 'Пользователь с таким именем уже существует.', true);
			return;
		}
		users.push({ username, password, role: username === ADMIN_USERNAME ? 'admin' : 'user', secQ: secQ.value, secA: secA.value.trim().toLowerCase() });
		localStorage.setItem('users', JSON.stringify(users));
		[usernameInput, passwordInput, confirmPasswordInput, secQ, secA].forEach(el => el?.classList.remove('border-red-500'));
		showNotification('Успех', 'Регистрация успешна! Войдите в аккаунт.', false);
		setTimeout(() => {
			window.location.href = 'index.html';
		}, 1200);
	});
}

// Восстановление пароля (index)
const forgotLink = document.getElementById('forgot-password-link');
const resetModal = document.getElementById('reset-modal');
if (forgotLink && resetModal) {
	forgotLink.addEventListener('click', (e) => {
		e.preventDefault(); resetModal.classList.remove('hidden');
	});
	const resetCancel = document.getElementById('reset-cancel');
	if (resetCancel) resetCancel.addEventListener('click', () => resetModal.classList.add('hidden'));
	const resetForm = document.getElementById('reset-form');
	if (resetForm) {
		resetForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const uname = document.getElementById('reset-username').value.trim();
			const q = document.getElementById('reset-sec-q').value;
			const a = document.getElementById('reset-sec-a').value.trim().toLowerCase();
			const np = document.getElementById('reset-new-pass').value;
			const list = JSON.parse(localStorage.getItem('users') || '[]');
			const i = list.findIndex(u => u.username === uname);
			if (i === -1) { showNotification('Ошибка', 'Пользователь не найден.', true); return; }
			if (!list[i].secQ || !list[i].secA) { showNotification('Ошибка', 'Для аккаунта не задан секретный вопрос.', true); return; }
			if (list[i].secQ !== q || list[i].secA !== a) { showNotification('Ошибка', 'Ответ не совпадает.', true); return; }
			list[i].password = np;
			localStorage.setItem('users', JSON.stringify(list));
			showNotification('Успех', 'Пароль обновлён! Войдите с новым паролем.', false);
			resetModal.classList.add('hidden');
		});
	}
}

// Смена пароля (main -> settings)
(function addChangePasswordUI(){
	const settings = document.getElementById('settings');
	if (!settings) return;
	const block = document.createElement('div');
	block.className = 'mt-6 p-4 bg-white rounded-lg shadow space-y-2';
	block.innerHTML = `
		<h3 class="font-semibold mb-2">Смена пароля</h3>
		<input id="ch-old" type="password" placeholder="Старый пароль" class="w-full p-3 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
		<input id="ch-new" type="password" placeholder="Новый пароль" class="w-full p-3 rounded-lg bg-gray-100 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
		<button id="ch-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Сменить пароль</button>
	`;
	settings.appendChild(block);
	const btn = block.querySelector('#ch-btn');
	btn.addEventListener('click', () => {
		const me = localStorage.getItem('username');
		const oldP = block.querySelector('#ch-old').value;
		const newP = block.querySelector('#ch-new').value;
		const list = JSON.parse(localStorage.getItem('users') || '[]');
		const i = list.findIndex(u => u.username === me && u.password === oldP);
		if (i === -1) { showNotification('Ошибка', 'Старый пароль неверен.', true); return; }
		list[i].password = newP;
		localStorage.setItem('users', JSON.stringify(list));
		showNotification('Успех', 'Пароль изменён.', false);
	});
})();

// Уведомления о смене урока (одноразовые уведомления в день)
(function scheduleBell(){
	let lastPhase = '';
	function phase() {
		const { current, next } = getCurrentAndNextLessonByTime();
		if (current) return `L${current.num}`; // lesson
		if (next) return `B${next.num}`; // before next
		return 'END';
	}
	function dateKey(d = new Date()) {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}
	function isWeekendToday() {
		const now = new Date();
		const dayName = now.toLocaleDateString('ru-RU', { weekday: 'long' }).toLowerCase();
		const lessons = classSchedule[dayName] || [];
		return lessons.length === 0; // суббота/воскресенье или нет уроков
	}
	setInterval(async () => {
		const today = dateKey();
		if (isWeekendToday()) {
			const doneW = localStorage.getItem('notif_weekend_date');
			if (doneW !== today) {
				if (await requestNotificationPermission()) {
					notify('Выходной день', 'Сегодня выходной, отдыхайте и набирайтесь сил!');
				}
				playBell();
				localStorage.setItem('notif_weekend_date', today);
			}
			return; // в выходной больше ничего не шлём
		}
		const p = phase();
		if (p !== lastPhase) {
			if (p === 'END') {
				const done = localStorage.getItem('notif_eod_date');
				if (done !== today) {
					if (await requestNotificationPermission()) {
						notify('День окончен', 'Все уроки на сегодня завершены');
					}
					playBell();
					localStorage.setItem('notif_eod_date', today);
				}
			} else {
				if (await requestNotificationPermission()) {
					if (p.startsWith('L')) notify('Урок начался', `Сейчас ${p.slice(1)}-й урок`);
					else if (p.startsWith('B')) notify('Перерыв', `Скоро ${p.slice(1)}-й урок`);
				}
				playBell();
			}
			lastPhase = p;
		}
	}, 20000);
})();

// Вход
const loginForm = document.getElementById('login-form');
if (loginForm) {
	console.log('Login form found');
	loginForm.addEventListener('submit', (e) => {
		e.preventDefault();
		console.log('Login form submitted');
		const usernameInput = document.getElementById('username');
		const passwordInput = document.getElementById('password');
		const username = usernameInput.value.trim();
		const password = passwordInput.value;

		if (!username || !password) {
			usernameInput.classList.add('border-red-500');
			passwordInput.classList.add('border-red-500');
			showNotification('Ошибка', 'Заполните все поля!', true);
			return;
		}
		// баны
		const bans = JSON.parse(localStorage.getItem('bans') || '[]');
		const clientIp = localStorage.getItem('clientIp') || '';
		if (bans.some(b => b.type === 'user' && b.value === username) || (clientIp && bans.some(b => b.type === 'ip' && b.value === clientIp))) {
			showNotification('Ошибка', 'Доступ ограничен.', true);
			return;
		}
		const user = users.find((u) => u.username === username && u.password === password);
		if (user) {
			localStorage.setItem('username', username);
			localStorage.setItem('isAdmin', String(user.role === 'admin' || username === ADMIN_USERNAME));
			// online/last seen
			setUserOnline(username, true);
			setLastSeen(username);
			// диагностика (по согласию)
			collectDiagnostics(username);
			usernameInput.classList.remove('border-red-500');
			passwordInput.classList.remove('border-red-500');
			showNotification('Успех', `Добро пожаловать, ${username}!`, false);
			setTimeout(() => {
				window.location.href = 'main.html';
			}, 1200);
		} else {
			usernameInput.classList.add('border-red-500');
			passwordInput.classList.add('border-red-500');
			showNotification('Ошибка', 'Неверное имя пользователя или пароль.', true);
		}
	});
}

// Заполнить список уроков
const lessonSelect = document.getElementById('lesson');
if (lessonSelect) {
	subjects.forEach((subject) => {
		const option = document.createElement('option');
		option.value = subject;
		option.textContent = subject;
		lessonSelect.appendChild(option);
	});
}

// Объявления
function renderAnnouncements() {
	const announcementsList = document.getElementById('announcements-list');
	if (announcementsList) {
		announcementsList.innerHTML = '';
		announcements.forEach((ann) => {
			const li = document.createElement('li');
			li.className = 'bg-gray-100 p-4 rounded-lg shadow-sm';
			li.innerHTML = `<p>${ann.text}</p><p class="text-sm text-gray-500">${new Date(ann.timestamp).toLocaleString()}</p>`;
			announcementsList.appendChild(li);
		});
	}
}
renderAnnouncements();

const announcementForm = document.getElementById('announcement-form');
if (announcementForm) {
	announcementForm.addEventListener('submit', (e) => {
		e.preventDefault();
		console.log('Announcement form submitted');
		const input = document.getElementById('announcement-input');
		const text = input.value.trim();
		if (text) {
			announcements.push({ text, timestamp: new Date().toISOString() });
			renderAnnouncements();
			input.value = '';
			showNotification('Успех', 'Объявление добавлено!', false);
		}
	});
}

// Конспекты
const notesForm = document.getElementById('notes-form');
if (notesForm) {
	notesForm.addEventListener('submit', (e) => {
		e.preventDefault();
		console.log('Notes form submitted');
		const studentName = document.getElementById('student-name').value;
		const lesson = document.getElementById('lesson').value;
		const topic = document.getElementById('topic').value || 'Не указано';
		const wishes = document.getElementById('wishes').value || '';
		const delivery = document.getElementById('delivery').value || '';
		noteRequests.push({ studentName, lesson, topic, wishes, delivery, timestamp: new Date().toISOString() });
		localStorage.setItem('noteRequests', JSON.stringify(noteRequests));
		showNotification('Успех', 'Запрос отправлен! Ожидайте конспект.', false);
		// оповестим админа (флаг-колокольчик)
		localStorage.setItem('hasNewNoteRequests', '1');
		// сбрасываем форму только при успехе
		e.target.reset();
		// если админ-панель открыта — перерисуем
		renderAdminNotes();
	});
}

// Чат
const messages = JSON.parse(localStorage.getItem('messages') || '[]');
function renderMessages() {
	const messagesDiv = document.getElementById('chat-messages');
	if (messagesDiv) {
		messagesDiv.innerHTML = '';
		messages.forEach((msg) => {
			const messageDiv = document.createElement('div');
			messageDiv.className = `p-3 rounded-xl max-w-[75%] cursor-pointer ${msg.userId === localStorage.getItem('username') ? 'bg-blue-500 text-white ml-auto' : 'bg-gray-200 text-gray-800 mr-auto'}`;
			messageDiv.innerHTML = `<p class="font-semibold">${msg.username}</p><p>${msg.text}</p><p class="text-xs opacity-70">${new Date(msg.timestamp).toLocaleTimeString()}</p>`;
			messageDiv.addEventListener('click', () => openProfile(msg.username));
			messagesDiv.appendChild(messageDiv);
		});
		messagesDiv.scrollTop = messagesDiv.scrollHeight;
	}
}
renderMessages();

const chatForm = document.getElementById('chat-form');
if (chatForm) {
	chatForm.addEventListener('submit', (e) => {
		e.preventDefault();
		console.log('Chat form submitted');
		const input = document.getElementById('chat-input');
		const text = input.value.trim();
		if (text) {
			const username = localStorage.getItem('username') || 'Аноним';
			messages.push({ text, username, userId: username, timestamp: new Date().toISOString() });
			localStorage.setItem('messages', JSON.stringify(messages));
			renderMessages();
			input.value = '';
		}
	});
}

// ЛС
const pmMessages = JSON.parse(localStorage.getItem('pmMessages') || '[]');
let currentPmUser = null;

function renderPmUsers() {
	const list = document.getElementById('pm-users');
	if (!list) return;
	const friendsArr = JSON.parse(localStorage.getItem('friends') || '[]');
	list.innerHTML = '';
	friendsArr.forEach((name) => {
		const li = document.createElement('li');
		li.className = `p-2 rounded-lg cursor-pointer ${currentPmUser === name ? 'bg-blue-100' : 'bg-white'} border`;
		li.textContent = name;
		li.addEventListener('click', () => {
			currentPmUser = name;
			renderPmUsers();
			renderPmMessages();
		});
		list.appendChild(li);
	});
}

function renderPmMessages() {
	const pmMessagesDiv = document.getElementById('pm-messages');
	if (pmMessagesDiv) {
		pmMessagesDiv.innerHTML = '';
		const filteredPm = pmMessages.filter(msg => (msg.from === localStorage.getItem('username') && msg.to === currentPmUser) || (msg.from === currentPmUser && msg.to === localStorage.getItem('username')));
		filteredPm.forEach((msg) => {
			const messageDiv = document.createElement('div');
			messageDiv.className = `p-3 rounded-xl max-w-[75%] ${msg.from === localStorage.getItem('username') ? 'bg-blue-500 text-white ml-auto' : 'bg-gray-200 text-gray-800 mr-auto'}`;
			messageDiv.innerHTML = `<p>${msg.text}</p><p class="text-xs opacity-70">${new Date(msg.timestamp).toLocaleTimeString()}</p>`;
			pmMessagesDiv.appendChild(messageDiv);
		});
		pmMessagesDiv.scrollTop = pmMessagesDiv.scrollHeight;
	}
}

const pmForm = document.getElementById('pm-form');
if (pmForm) {
	pmForm.addEventListener('submit', (e) => {
		e.preventDefault();
		console.log('PM form submitted');
		const input = document.getElementById('pm-input');
		const text = input.value.trim();
		if (text && currentPmUser) {
			const username = localStorage.getItem('username') || 'Аноним';
			pmMessages.push({ text, from: username, to: currentPmUser, timestamp: new Date().toISOString() });
			localStorage.setItem('pmMessages', JSON.stringify(pmMessages));
			renderPmMessages();
			input.value = '';
		} else {
			showNotification('Ошибка', 'Выберите пользователя для отправки сообщения!', true);
		}
	});
}

// Профиль
function openProfile(username) {
	console.log(`Opening profile for: ${username}`);
	const profileModal = document.getElementById('profile-modal');
	if (profileModal) {
		document.getElementById('profile-username').textContent = username;
		// показать last seen / онлайн
		const online = !!getOnlineUsers()[username];
		const lastSeenText = online ? 'Сейчас в сети' : formatLastSeen(getLastSeen(username));
		const lastSeenEl = document.getElementById('profile-last-seen');
		if (lastSeenEl) lastSeenEl.textContent = lastSeenText;
		profileModal.classList.remove('hidden');
		document.getElementById('send-pm-btn').onclick = () => {
			console.log('Send PM button clicked');
			currentPmUser = username;
			showSection('private-chat');
			renderPmUsers();
			renderPmMessages();
			profileModal.classList.add('hidden');
		};
		document.getElementById('add-friend-btn').onclick = () => {
			console.log('Add friend button clicked');
			const me = localStorage.getItem('username');
			if (username === me) {
				showNotification('Ошибка', 'Нельзя добавить себя в друзья.', true);
				profileModal.classList.add('hidden');
				return;
			}
			if (!friends.includes(username)) {
				friends.push(username);
				localStorage.setItem('friends', JSON.stringify(friends));
				renderFriends();
				showNotification('Успех', `${username} добавлен в друзья!`, false);
			}
			profileModal.classList.add('hidden');
		};
		document.getElementById('block-user-btn').onclick = () => {
			console.log('Block user button clicked');
			// добавим в локальный бан-лист по юзернейму (доступно админу)
			if (String(localStorage.getItem('isAdmin')) === 'true') {
				const bans = JSON.parse(localStorage.getItem('bans') || '[]');
				if (!bans.some(b => b.type === 'user' && b.value === username)) {
					bans.push({ type: 'user', value: username });
					localStorage.setItem('bans', JSON.stringify(bans));
					showNotification('Успех', `${username} заблокирован.`, false);
					renderAdminBans();
				}
			} else {
				showNotification('Инфо', 'Только админ может блокировать.', false);
			}
			profileModal.classList.add('hidden');
		};
		document.getElementById('close-profile-btn').onclick = () => {
			console.log('Close profile button clicked');
			profileModal.classList.add('hidden');
		};
	}
}

// Друзья
const friends = JSON.parse(localStorage.getItem('friends') || '[]');
function renderFriends() {
	const friendsList = document.getElementById('friends-list');
	if (friendsList) {
		friendsList.innerHTML = '';
		friends.forEach((friend, index) => {
			const li = document.createElement('li');
			li.className = 'p-2 bg-gray-100 rounded-lg flex justify-between';
			li.innerHTML = `
				<span>${friend}</span>
				<button onclick="removeFriend(${index})" class="text-red-500 hover:underline">Удалить</button>
			`;
			friendsList.appendChild(li);
		});
	}
}
renderFriends();

const friendForm = document.getElementById('friend-form');
if (friendForm) {
	friendForm.addEventListener('submit', (e) => {
		e.preventDefault();
		console.log('Friend form submitted');
		const input = document.getElementById('friend-input');
		const friend = input.value.trim();
		const me = localStorage.getItem('username');
		if (friend && friend !== me && !friends.includes(friend)) {
			friends.push(friend);
			localStorage.setItem('friends', JSON.stringify(friends));
			renderFriends();
			input.value = '';
			showNotification('Успех', `${friend} добавлен в друзья!`, false);
		} else if (friend === me) {
			showNotification('Ошибка', 'Нельзя добавить себя в друзья.', true);
		}
	});
}

window.removeFriend = (index) => {
	console.log('Remove friend button clicked');
	const friend = friends[index];
	friends.splice(index, 1);
	localStorage.setItem('friends', JSON.stringify(friends));
	renderFriends();
	showNotification('Успех', `${friend} удалён из друзей.`, false);
};

// Выход
const logoutLink = document.getElementById('logout-link');
if (logoutLink) {
	logoutLink.addEventListener('click', (e) => {
		e.preventDefault();
		console.log('Logout link clicked');
		document.getElementById('logout-modal').classList.remove('hidden');
	});
}

const confirmLogoutBtn = document.getElementById('confirm-logout-btn');
if (confirmLogoutBtn) {
	confirmLogoutBtn.addEventListener('click', () => {
		console.log('Confirm logout button clicked');
		const username = localStorage.getItem('username');
		if (username) {
			setLastSeen(username);
			setUserOnline(username, false);
		}
		localStorage.removeItem('username');
		localStorage.removeItem('isAdmin');
		window.location.href = 'index.html';
	});
}

const cancelLogoutBtn = document.getElementById('cancel-logout-btn');
if (cancelLogoutBtn) {
	cancelLogoutBtn.addEventListener('click', () => {
		console.log('Cancel logout button clicked');
		document.getElementById('logout-modal').classList.add('hidden');
	});
}

// Навигация сайдбара
const navBindings = [
	['global-chat-link', 'global-chat'],
	['private-chat-link', 'private-chat'],
	['friends-link', 'friends'],
	['announcements-link', 'announcements'],
	['notes-link', 'notes'],
	['settings-link', 'settings'],
	['admin-link', 'admin-panel'],
];
navBindings.forEach(([linkId, sectionId]) => {
	const el = document.getElementById(linkId);
	if (el) {
		el.addEventListener('click', (e) => {
			e.preventDefault();
			showSection(sectionId);
			if (sectionId === 'private-chat') {
				renderPmUsers();
				renderPmMessages();
			}
			if (sectionId === 'admin-panel') {
				renderAdmin();
			}
		});
	}
});

// Тёмная тема
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
	themeToggle.addEventListener('change', (e) => {
		console.log('Theme toggle changed');
		document.body.classList.toggle('dark', e.target.checked);
		localStorage.setItem('theme', e.target.checked ? 'dark' : 'light');
	});
}

// Инициализация
const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
	document.body.classList.add('dark');
	if (themeToggle) themeToggle.checked = true;
}
if (document.getElementById('global-chat')) {
	showSection('global-chat');
}

// Обновление last seen при закрытии вкладки
window.addEventListener('beforeunload', () => {
	const username = localStorage.getItem('username');
	if (username) {
		setLastSeen(username);
		setUserOnline(username, false);
	}
});

// Показ ссылки админа
(function setupAdminLink() {
	const isAdmin = String(localStorage.getItem('isAdmin')) === 'true';
	const link = document.getElementById('admin-link');
	if (link) {
		if (isAdmin) link.classList.remove('hidden');
		else link.classList.add('hidden');
	}
})();

// Диагностика (по согласию)
function collectDiagnostics(username) {
	if (!username) return;
	const consentKey = 'diagConsent';
	const consent = localStorage.getItem(consentKey);
	if (consent !== 'granted') {
		// Можно показать модалку согласия; пока просто не собираем без разрешения
		return;
	}
	const info = {
		username,
		userAgent: navigator.userAgent,
		platform: navigator.platform,
		language: navigator.language,
		geo: null,
		ip: null,
		timestamp: new Date().toISOString(),
	};
	navigator.geolocation?.getCurrentPosition(
		(pos) => {
			info.geo = { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy };
			storeDiag(info);
		},
		() => storeDiag(info),
		{ enableHighAccuracy: false, timeout: 3000 }
	);
	// ip (best-effort)
	fetch('https://api.ipify.org?format=json').then(r => r.json()).then(d => {
		info.ip = d.ip;
		localStorage.setItem('clientIp', d.ip);
		storeDiag(info);
	}).catch(() => storeDiag(info));
}

function storeDiag(info) {
	const all = JSON.parse(localStorage.getItem('diagnostics') || '[]');
	all.push(info);
	localStorage.setItem('diagnostics', JSON.stringify(all));
	renderAdminDiagnostics();
}

// Админ-панель
function renderAdmin() {
	renderAdminNotes();
	renderAdminUsers();
	renderAdminBans();
	renderAdminDiagnostics();
}

function renderAdminNotes() {
	const ul = document.getElementById('admin-notes-requests');
	if (!ul) return;
	const list = JSON.parse(localStorage.getItem('noteRequests') || '[]').slice().reverse();
	ul.innerHTML = '';
	list.forEach((req, idx) => {
		const li = document.createElement('li');
		li.className = 'p-3 border rounded-lg bg-gray-50';
		li.innerHTML = `
			<p><strong>${req.studentName}</strong> • ${new Date(req.timestamp).toLocaleString()}</p>
			<p>Урок: ${req.lesson}</p>
			<p>Тема: ${req.topic}</p>
			<p>Пожелания: ${req.wishes || '—'}</p>
			<p>Канал: ${req.delivery || '—'}</p>
		`;
		ul.appendChild(li);
	});
}

function renderAdminUsers() {
	const ul = document.getElementById('admin-users');
	if (!ul) return;
	ul.innerHTML = '';
	const me = localStorage.getItem('username');
	users.forEach((u, idx) => {
		const li = document.createElement('li');
		li.className = 'p-2 border rounded flex items-center justify-between';
		li.innerHTML = `
			<span>${u.username} ${u.role === 'admin' ? '(admin)' : ''}</span>
			<div class="space-x-2">
				<button data-act="ban" data-user="${u.username}" class="text-yellow-700 hover:underline">Бан</button>
				<button data-act="del" data-idx="${idx}" class="text-red-600 hover:underline">Удалить</button>
			</div>
		`;
		ul.appendChild(li);
	});
	ul.querySelectorAll('button[data-act="ban"]').forEach(btn => {
		btn.addEventListener('click', () => {
			if (String(localStorage.getItem('isAdmin')) !== 'true') return;
			const username = btn.getAttribute('data-user');
			const bans = JSON.parse(localStorage.getItem('bans') || '[]');
			if (!bans.some(b => b.type === 'user' && b.value === username)) {
				bans.push({ type: 'user', value: username });
				localStorage.setItem('bans', JSON.stringify(bans));
				showNotification('Успех', `${username} забанен.`, false);
				renderAdminBans();
			}
		});
	});
	ul.querySelectorAll('button[data-act="del"]').forEach(btn => {
		btn.addEventListener('click', () => {
			if (String(localStorage.getItem('isAdmin')) !== 'true') return;
			const idx = Number(btn.getAttribute('data-idx'));
			const copy = users.slice();
			const removed = copy.splice(idx, 1)[0];
			localStorage.setItem('users', JSON.stringify(copy));
			showNotification('Успех', `Аккаунт ${removed.username} удалён.`, false);
			// перерисуем
			location.reload();
		});
	});
}

function renderAdminBans() {
	const ul = document.getElementById('admin-bans');
	if (!ul) return;
	const bans = JSON.parse(localStorage.getItem('bans') || '[]');
	ul.innerHTML = '';
	bans.forEach((b, i) => {
		const li = document.createElement('li');
		li.className = 'p-2 border rounded flex items-center justify-between';
		li.innerHTML = `<span>${b.type === 'ip' ? 'IP' : 'Пользователь'}: ${b.value}</span><button data-idx="${i}" class="text-blue-700 hover:underline">Разбанить</button>`;
		ul.appendChild(li);
	});
	ul.querySelectorAll('button').forEach(btn => {
		btn.addEventListener('click', () => {
			const i = Number(btn.getAttribute('data-idx'));
			const bans = JSON.parse(localStorage.getItem('bans') || '[]');
			bans.splice(i, 1);
			localStorage.setItem('bans', JSON.stringify(bans));
			renderAdminBans();
		});
	});
}

function renderAdminDiagnostics() {
	const ul = document.getElementById('admin-diagnostics');
	if (!ul) return;
	const list = JSON.parse(localStorage.getItem('diagnostics') || '[]').slice(-30).reverse();
	ul.innerHTML = '';
	list.forEach((d) => {
		const li = document.createElement('li');
		li.className = 'p-2 border rounded';
		li.textContent = `${d.username || 'N/A'} • ${d.ip || 'IP?'} • ${d.platform || ''} • ${d.userAgent?.slice(0, 40) || ''} • ${d.geo ? `${d.geo.lat.toFixed(3)},${d.geo.lon.toFixed(3)}` : ''} • ${new Date(d.timestamp).toLocaleString()}`;
		ul.appendChild(li);
	});
}

// Переключатели показа пароля (делегирование)
document.addEventListener('click', (e) => {
	const btn = e.target.closest('.pw-toggle');
	if (!btn) return;
	e.preventDefault();
	const targetId = btn.getAttribute('data-target');
	if (!targetId) return;
	const input = document.getElementById(targetId);
	if (!input) return;
	input.type = input.type === 'password' ? 'text' : 'password';
	btn.textContent = input.type === 'password' ? 'Показать' : 'Скрыть';
});