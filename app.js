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
        console.log(movies);
        // Render the index.ejs template with the movies data
        res.render('index', { movies });
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

app.get('/genres', async (req, res) => {
    try {
        const genres = await moviesCollection.distinct('genres');
        console.log('Available genres:', genres);
        res.json({ genres });
    } catch (err) {
        console.error('Error fetching genres:', err);
        res.status(500).send('Error fetching genres');
    }
});
console.log(`Visit http://localhost:${PORT} to access the application`);