const express = require('express');
const app = express();

const PORT = process.env.PORT_ONE || 8000;
const mongoose = require('mongoose');
const Product = require('./product');
const jwt = require('jsonwebtoken');
const amqp = require('amqplib');
const isAuthenticated = require('../isAuthenticated');

var order;

var channel , connection;

app.use(express.json());

mongoose.connect(
    "mongodb://localhost/product-service",{
        useNewUrlParser: true,
        useUnifiedTopology: true
    },
    () => {
        console.log(`Product Service DB Connected`);
    }
);


async function connect() {
    const amqpServer = "amqp://localhost:5672";
    connection = await amqp.connect(amqpServer);
    channel = await connection.createChannel();
    await channel.assertQueue("PRODUCT");
}

connect();

app.post("/product/buy", isAuthenticated , async (req,res) => {
    const {ids} = req.body;
    const products = await Product.find({_id : {$in: ids}});
    channel.sendToQueue(
        "ORDER",
        Buffer.from(
            JSON.stringify({
                products,
                userEmail: req.user.email,
            })
        )
    );
    channel.consume("PRODUCT", (data) => {
        console.log("Consuming Product Queue");
        order = JSON.parse(data.content);
    });
    return res.json(order);
})



//Create
app.post('/product/create', isAuthenticated , async (req,res) => {
    const {name, description, price} = req.body;
    const newProduct = new Product ({
        name,
        description,
        price
    });
    newProduct.save();
    return res.json(newProduct);
})



app.listen(PORT, () => {
    console.log(`Product-Service at ${PORT}`);
})
