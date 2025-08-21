// data.js
const classSchedule = {
    'понедельник': [
        { subject: 'Алгебра', time: '08:00-08:45' },
        { subject: 'Физика', time: '09:00-09:45' },
        { subject: 'Русский язык', time: '10:00-10:45' },
        { subject: 'Физкультура', time: '11:00-11:45' },
        { subject: 'История', time: '12:00-12:45' },
    ],
    'вторник': [
        { subject: 'Геометрия', time: '08:00-08:45' },
        { subject: 'Биология', time: '09:00-09:45' },
        { subject: 'Английский язык', time: '10:00-10:45' },
        { subject: 'Информатика', time: '11:00-11:45' },
        { subject: 'Музыка', time: '12:00-12:45' },
    ],
    'среда': [
        { subject: 'Химия', time: '08:00-08:45' },
        { subject: 'Литература', time: '09:00-09:45' },
        { subject: 'Основы безопасности', time: '10:00-10:45' },
        { subject: 'Обществознание', time: '11:00-11:45' },
        { subject: 'Изобразительное искусство', time: '12:00-12:45' },
    ],
    'четверг': [
        { subject: 'Физика', time: '08:00-08:45' },
        { subject: 'География', time: '09:00-09:45' },
        { subject: 'Математика', time: '10:00-10:45' },
        { subject: 'Английский язык', time: '11:00-11:45' },
        { subject: 'Технология', time: '12:00-12:45' },
    ],
    'пятница': [
        { subject: 'Русский язык', time: '08:00-08:45' },
        { subject: 'История', time: '09:00-09:45' },
        { subject: 'Алгебра', time: '10:00-10:45' },
        { subject: 'Физкультура', time: '11:00-11:45' },
        { subject: 'Астрономия', time: '12:00-12:45' },
    ],
};
const announcements = [
    { text: 'Не забудьте сдать проекты по физике до конца недели.', timestamp: new Date().toISOString() },
    { text: 'На следующей неделе урок алгебры переносится на 14:00.', timestamp: new Date().toISOString() },
    { text: 'Новый полезный конспект по истории доступен в папке "Документы".', timestamp: new Date().toISOString() },
];
const subjects = [...new Set(Object.values(classSchedule).flat().map((lesson) => lesson.subject))];
const noteRequests = JSON.parse(localStorage.getItem('noteRequests') || '[]');
const users = JSON.parse(localStorage.getItem('users') || '[]');
export { classSchedule, announcements, subjects, noteRequests, users };