const express = require('express');
const app = express();
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');
const { MongoClient } = require('mongodb');
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
        // Filtro base: solo películas con los campos requeridos
        const filter = {
            title: { $exists: true, $ne: null },
            poster: { $exists: true, $ne: null },
            released: { $exists: true, $ne: null }
        };

        // Añadir criterios de búsqueda según los query params
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

      const movies = await moviesCollection.aggregate([
            { $match: filter },
            { $group: {
                _id: { title: "$title", released: "$released", poster: "$poster" },
                doc: { $first: "$$ROOT" }
            } },
            { $replaceRoot: { newRoot: "$doc" } },
            { $sort: sort },
            { $limit: 10 }
        ]).toArray();

        console.log('Movies fetched successfully');
        res.render('index', { movies });
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
            type: req.body.type
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