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

const client = new MongoClient(`mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}/`);


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