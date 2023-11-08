const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000;


// middleware
app.use(cors(
    {
        origin: [
            // 'http://localhost:5173'
            'https://restaurant-management-server-side.vercel.app/',
            'https://restaurant-management-6fce7.web.app'
        ],
        credentials: true
    }
))
app.use(express.json());
app.use(cookieParser());

//mongodb connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.drfmhtt.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



// custom made middlewares

const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
// console.log(token);
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access' })
    }
    jwt.verify(token, process.env.Access_Token_Secret, (error, decoded) => {
        if (error) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.user = decoded;
        next()
    })
}


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const userCollection = client.db('restaurantManagementDB').collection('Users')
        const foodCollection = client.db('restaurantManagementDB').collection('Foods')
        const sliderCollection = client.db('restaurantManagementDB').collection('HomeBannerSlider')
        const orderCollection = client.db('restaurantManagementDB').collection('Orders')


        // getting all home banner slider data
        app.get('/api/v1/home-banner-slider', async (req, res) => {
            const result = await sliderCollection.find().toArray();
            res.send(result);
        })

        // getting all foods
        // pagination
        // filtering
        // food count
        // searching

        app.get('/api/v1/foods', async (req, res) => {
            let queryObj = {};
            let sortObj = {};
            const category = req.query.category;
            const sortField = req.query.sortField;
            const sortOrder = req.query.sortOrder;
            const page = Number(req.query.page);
            const limit = Number(req.query.limit);
            const skip = (page - 1) * limit;
            const foodName = req.query.foodName;
            // console.log(category,sortField,sortOrder,page,limit,skip);
            if (category) {
                queryObj.foodCategory = category;
            }
            if (sortField && sortOrder) {
                sortObj[sortField] = sortOrder;
            }
            if (foodName) {
                const searchTerm = new RegExp(foodName, 'i'); // 'i' for case-insensitive search
                queryObj.foodName = searchTerm;
            }
            const count = await foodCollection.estimatedDocumentCount();
            const result = await foodCollection.find(queryObj).skip(skip).limit(limit).sort(sortObj).toArray();
            // console.log({ result, count });
            res.send({ result, count })
        })
        //update quantity
        app.put('/api/v1/foods/:foodId', async (req, res) => {
            const id = req.params.foodId;
            const updatedFood = req.body;
            console.log(updatedFood);
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    quantity: updatedFood.quantity,
                    sellCount: updatedFood.sellCount
                },

            };
            const result = await foodCollection.updateOne(filter, updateDoc, options)
            console.log(result);
            res.send(result)
        })



        // get orders
        app.get('/api/v1/user/food-orders/:userEmail', verifyToken, async (req, res) => {
            const userEmail = req.params.userEmail; 
            console.log(userEmail);
            if (!userEmail) {
                return res.status(400).send('User email is required.');
            }
            console.log("emailCom",req.user.email,userEmail);
            if (req.user.email !== userEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { userEmail: userEmail }
            const result = await orderCollection.find(query).toArray();
            res.send(result);
        });
        // get add foods
        app.get('/api/v1/user/added-foods', async (req, res) => {
            let userEmailObj = {};
            let foodIdObj = {};
            const userEmail = req.query.userEmail;
            const foodId = req.query.foodId;
            // console.log(userEmail);
            // console.log(foodId); 
            if (!userEmail) {
                return res.status(400).send('User email is required.');
            }
            if (userEmail) {
                userEmailObj.userEmail = userEmail;
            }
            if (foodId) {
                foodIdObj._id = new ObjectId(foodId);
                foodIdObj.userEmail = userEmail;
            }
            // const query = { userEmail: userEmail }

            const SingleResult = await foodCollection.findOne(foodIdObj);
            const result = await foodCollection.find(userEmailObj).toArray();
            res.send({ result, SingleResult });
        });



        // getting all foods
        app.get('/api/v1/foodDetails/:foodId', async (req, res) => {
            const id = req.params.foodId;
            const query = { _id: new ObjectId(id) }
            // const options =  {
            //     projection: {title:1,price:1,image:1}
            // }
            const result = await foodCollection.findOne(query);
            res.send(result)
        })


        // auth related api
        app.post('/api/v1/auth/access-token', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.Access_Token_Secret, { expiresIn: '1h' });

            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none'
            }).send({ success: true })

        })
        app.post('/logOut', async (req, res) => {
            const user = req.body;
            res.clearCookie('token', { maxAge: 0 }).send({ success: true })
        })



        // add a food 
        app.post('/api/v1/user/add-food', async (req, res) => {
            const food = req.body;
            const result = await foodCollection.insertOne(food)
            res.send(result)
        })


        // top selling food api
        app.get('/api/v1/foods/desc', async (req, res) => {
            const result = await foodCollection.find().sort({ sellCount: 'desc' }).toArray();
            res.send(result);
        })
        // placed order
        app.post('/api/v1/user/food-order', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order)
            res.send(result)
        })


        // delete a food
        app.delete('/api/v1/user/delete-food/:foodId', async (req, res) => {
            const id = req.params.foodId;
            console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await foodCollection.deleteOne(query);
            res.send(result)
        })
        // delete a order

        app.delete('/api/v1/user/delete-order/:orderId', async (req, res) => {
            const orderId = req.params.orderId;
            const query = { _id: new ObjectId(orderId) }
            const result = await orderCollection.deleteOne(query);
            res.send(result)
        });


        // update a food
        app.put('/api/v1/user/update-food/:foodId', async (req, res) => {
            const id = req.params.foodId;
            const updatedFood = req.body;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    foodName: updatedFood.foodName,
                    foodImage: updatedFood.foodImage,
                    foodCategory: updatedFood.foodCategory,
                    quantity: updatedFood.quantity,
                    price: updatedFood.price,
                    foodOrigin: updatedFood.foodOrigin,
                    shortDescription: updatedFood.shortDescription
                },

            };
            const result = await foodCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



// respond with "hello world" when a get request is made to the homepage
app.get('/', (req, res) => {
    res.send('Restaurant is running')
})

app.listen(port, () => {
    console.log(`server is running on port: ${port}`);
})