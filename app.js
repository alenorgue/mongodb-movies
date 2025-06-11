const express = require('express');
const app = express();
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const { title } = require('process');
const dotenv = require('dotenv');

dotenv.config();

const PORT = 5000;


app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/partials', express.static(path.join(__dirname, 'views', 'partials')));
app.set('views', path.join(__dirname, 'views'));

const client = new MongoClient(`mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}/`);
let moviesCollection;

//Routes
app.get('/', async (req, res) => {

    console.log('Fetching movies from the database...');
    try {
        const movies = await moviesCollection.find(
            {
                title: { $exists: true, $ne: null },
                poster: { $exists: true, $ne: null },
                released: { $exists: true, $ne: null }
            },
            {
                projection: { title: 1, poster: 1, released: 1 }
            }
        )
        .sort({ released: -1 })
        .limit(10)
        .toArray();
        console.log('Movies fetched successfully');
        // Lee el mensaje de éxito desde query param
        const success = req.query.success === '1';
        res.render('index', { movies, success });
    } catch (err) {
        console.error('Error fetching movies:', err);
        res.status(500).send('Error fetching movies');
    }
});

app.get('/movies', async (req, res) => {
    console.log('Fetching movies from the database...');
    try {
        const filter = {
            title: { $exists: true, $ne: null },
            poster: { $exists: true, $ne: null },
            released: { $exists: true, $ne: null }
        };
        // Filtros avanzados
        if (req.query.title) {
            filter.title = { ...filter.title, $regex: req.query.title, $options: 'i' };
        }
        if (req.query.yearFrom || req.query.yearTo) {
            filter.released = filter.released || {};
            if (req.query.yearFrom) {
                filter.released.$gte = new Date(`${req.query.yearFrom}-01-01`);
            }
            if (req.query.yearTo) {
                filter.released.$lte = new Date(`${req.query.yearTo}-12-31`);
            }
        }
        if (req.query.genre) {
            if (Array.isArray(req.query.genre)) {
                filter.genres = { $in: req.query.genre };
            } else if (typeof req.query.genre === 'string' && req.query.genre.length > 0) {
                filter.genres = req.query.genre;
            }
        }
        if (req.query.director) {
            filter.directors = { $regex: req.query.director, $options: 'i' };
        }
        if (req.query.cast) {
            filter.cast = { $regex: req.query.cast, $options: 'i' };
        }
        if (req.query.plot) {
            filter.plot = { $regex: req.query.plot, $options: 'i' };
        }
        if (req.query.type) {
            filter.type = { $regex: req.query.type, $options: 'i' };
        }
        let sort = { released: -1 };
        if (req.query.sortOrder === 'asc') {
            sort = { released: 1 };
        }
        // Paginación
        const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        // Contar total de resultados
        const totalResults = await moviesCollection.countDocuments(filter);
        const totalPages = Math.ceil(totalResults / limit);
        // Consulta paginada
        const movies = await moviesCollection.aggregate([
            { $match: filter },
            { $group: {
                _id: { title: "$title", released: "$released", poster: "$poster" },
                doc: { $first: "$$ROOT" }
            } },
            { $replaceRoot: { newRoot: "$doc" } },
            { $sort: sort },
            { $skip: skip },
            { $limit: limit }
        ]).toArray();
        // Pasar filtros activos para mantenerlos en la paginación
        const filters = { ...req.query };
        delete filters.page;
        res.render('index', { movies, page, totalPages, totalResults, filters });
    } catch (err) {
        console.error('Error fetching movies:', err);
        res.status(500).send('Error fetching movies');
    }
});

app.get('/movies/add-form', async (req, res) => {
    try {
        res.render('add-form');
    } catch (err) {
        console.error('Error rendering add-form:', err);
        res.status(500).send('Error rendering add-form');
    }
});

app.post('/movies/add-form', async (req, res) => {
    try {
        const newMovie = {
            title: req.body.title,
            released: req.body.released ? new Date(req.body.released) : null,
            poster: req.body.poster,
            director: req.body.director,
            cast: req.body.cast ? req.body.cast.split(',').map(actor => actor.trim()) : [],
            plot: req.body.plot,
            genres: req.body.genres ? req.body.genres.split(',').map(genre => genre.trim()) : [],
            type: req.body.type,
            runtime: req.body.runtime ? parseInt(req.body.runtime, 10) : null
        };

        const result = await moviesCollection.insertOne(newMovie);
       console.log('New movie added:', result.insertedId);
        req.app.locals.successMessage = 'Película añadida con éxito';
        res.redirect('/?success=1');
    } catch (err) {
        console.error('Error adding movie:', err);
        res.status(500).send('Error adding movie');
    }
});

app.get('/movies/recommendation', async (req, res) => {
    const genres = [
        { name: 'Action', icon: '🔫' },
        { name: 'Adventure', icon: '🏔️' },
        { name: 'Animation', icon: '🎨' },
        { name: 'Biography', icon: '👤' },
        { name: 'Comedy', icon: '😂' },
        { name: 'Crime', icon: '🔪' },
        { name: 'Documentary', icon: '📚' },
        { name: 'Drama', icon: '🎭' },
        { name: 'Family', icon: '👨‍👩‍👧‍👦' },
        { name: 'Fantasy', icon: '✨' },
        { name: 'Film-Noir', icon: '🕵️' },
        { name: 'History', icon: '🏛️' },
        { name: 'Horror', icon: '👻' },
        { name: 'Music', icon: '🎵' },
        { name: 'Musical', icon: '🎤' },
        { name: 'Mystery', icon: '🕵️‍♂️' },
        { name: 'News', icon: '📰' },
        { name: 'Romance', icon: '💖' },
        { name: 'Sci-Fi', icon: '🚀' },
        { name: 'Short', icon: '⏱️' },
        { name: 'Sport', icon: '⚽' },
        { name: 'Talk-Show', icon: '🎤' },
        { name: 'Thriller', icon: '🔫' },
        { name: 'War', icon: '🪖' },
        { name: 'Western', icon: '🤠' }
    ];
    let recommendations = null;
    let selectedGenre = req.query.genre;
    if (selectedGenre) {
        recommendations = await moviesCollection.aggregate([
            { $match: { genres: selectedGenre, poster: { $exists: true, $ne: null } } },
            { $sample: { size: 2 } },
            { $project: { title: 1, poster: 1, released: 1, _id: 1 } }
        ]).toArray();
    }
    res.render('recommendation', { genres, recommendations, selectedGenre });
});

app.get('/movies/:id', async (req, res) => {
    try {
        const movieId = req.params.id;
        if (!ObjectId.isValid(movieId)) {
            return res.status(400).send('ID de película no válido');
        }
        const movie = await moviesCollection.findOne({ _id: new ObjectId(movieId) });
        if (!movie) {
            return res.status(404).send('Película no encontrada');
        }
        res.render('movie-detail', { movie });
    } catch (err) {
        console.error('Error fetching movie detail:', err);
        res.status(500).send('Error al cargar detalles de la película');
    }
});

// Middleware para manejar errores 404
app.use((req, res, next) => {
    res.status(404).render('404', { title: 'Página no encontrada' });
});
// Middleware para manejar errores internos del servidor
app.use((err, req, res, next) => {
    console.error('Error interno del servidor:', err);
    res.status(500).render('error', { title: 'Error interno del servidor', error: err });
});

async function connectDB() {
    try {
        await client.connect();
        const db = client.db('sample_mflix');
        moviesCollection = db.collection('movies');
        console.log('Connected to MongoDB sample_mflix');
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    }
}

connectDB();


console.log(`Visit http://localhost:${PORT} to access the application`);