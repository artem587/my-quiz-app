require('dotenv').config(); // Для безопасности (если используешь .env файл)
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// --- ПОДКЛЮЧЕНИЕ К MONGODB ---
// Мы берем ссылку из переменной окружения (настроим её на Render)
// Если запускаешь локально, вставь свою ссылку вместо process.env.MONGO_URI
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/quizapp';

mongoose.connect(mongoURI)
    .then(() => console.log('✅ MongoDB подключена'))
    .catch(err => console.error('❌ Ошибка MongoDB:', err));

// --- СХЕМЫ ДАННЫХ (Как выглядят данные в базе) ---

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'student' } // 'admin' или 'student'
});
const User = mongoose.model('User', UserSchema);

const QuizSchema = new mongoose.Schema({
    title: String,
    description: String,
    questions: [
        {
            text: String,
            options: [String],
            correct: Number
        }
    ]
});
const Quiz = mongoose.model('Quiz', QuizSchema);

// --- АВТОМАТИЧЕСКОЕ СОЗДАНИЕ АДМИНА ---
// При запуске проверяем, есть ли админ. Если нет - создаем.
async function createInitialUser() {
    const count = await User.countDocuments();
    if (count === 0) {
        await new User({ username: 'admin', password: '123', role: 'admin' }).save();
        await new User({ username: 'student', password: '123', role: 'student' }).save();
        console.log('✨ Созданы начальные пользователи: admin/123 и student/123');
    }
}
createInitialUser();

// --- API ---

// 1. Вход
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    
    if (user) {
        res.json({ success: true, role: user.role, username: user.username });
    } else {
        res.status(401).json({ success: false, message: "Неверно!" });
    }
});

// 2. Получить все квизы
app.get('/api/quizzes', async (req, res) => {
    const quizzes = await Quiz.find();
    res.json(quizzes);
});

// 3. Получить один квиз
app.get('/api/quizzes/:id', async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id);
        res.json(quiz);
    } catch {
        res.status(404).json({ message: "Не найдено" });
    }
});

// 4. Создать (Только админ - упрощенная проверка)
app.post('/api/quizzes', async (req, res) => {
    if (req.headers['x-user-role'] !== 'admin') {
        return res.status(403).json({ message: "Запрещено" });
    }
    const newQuiz = new Quiz(req.body);
    await newQuiz.save();
    res.json(newQuiz);
});

// 5. Удалить
app.delete('/api/quizzes/:id', async (req, res) => {
    if (req.headers['x-user-role'] !== 'admin') {
        return res.status(403).json({ message: "Запрещено" });
    }
    await Quiz.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

// Запуск
app.listen(PORT, () => {
    console.log(`Сервер готов на порту ${PORT}`);
});