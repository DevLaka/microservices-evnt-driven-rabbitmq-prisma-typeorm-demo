import express, { Request, Response } from "express";
import cors from "cors";
import { createConnection } from "typeorm";
import * as ampqp from "amqplib/callback_api";
import { Product } from "./entity/product";
import axios from "axios";

createConnection().then((db) => {
  const productRepository = db.getMongoRepository(Product);
  ampqp.connect(
    "amqps://rygleyet:o7XacN8QGBp1qZA6_Z2AbM0gVi12gr5W@armadillo.rmq.cloudamqp.com/rygleyet",
    (error0, connection) => {
      if (error0) {
        throw error0;
      }
      connection.createChannel((error1, channel) => {
        if (error1) {
          throw error1;
        }

        channel.assertQueue("product_created", { durable: false });
        channel.assertQueue("product_updated", { durable: false });
        channel.assertQueue("product_deleted", { durable: false });

        const app = express();

        app.use(
          cors({
            origin: [
              "http://loclhost:3000",
              "http://loclhost:8080",
              "http://loclhost:4200",
            ],
          })
        );

        app.use(express.json());

        channel.consume(
          "product_created",
          async (msg) => {
            if (msg) {
              const eventProduct: Product = JSON.parse(msg.content.toString());
              const product = new Product();
              product.admin_id = parseInt(eventProduct.id);
              product.title = eventProduct.title;
              product.image = eventProduct.image;
              product.likes = eventProduct.likes;
              await productRepository.save(product);
              console.log("product created");
            }
          },
          { noAck: true }
        );

        channel.consume(
          "product_updated",
          async (msg) => {
            if (msg) {
              const eventProduct: Product = JSON.parse(msg.content.toString());
              const product = await productRepository.findOne({
                admin_id: parseInt(eventProduct.id),
              });
              if (product) {
                productRepository.merge(product, {
                  title: eventProduct.title,
                  image: eventProduct.image,
                  likes: eventProduct.likes,
                });
                await productRepository.save(product);
                console.log("product updated");
              }
            }
          },
          { noAck: true }
        );

        channel.consume(
          "product_deleted",
          async (msg) => {
            if (msg) {
              const admin_id = parseInt(JSON.parse(msg.content.toString()));
              await productRepository.deleteOne({ admin_id });
              console.log("product deleted");
            }
          },
          { noAck: true }
        );

        app.get("/api/products", async (req: Request, res: Response) => {
          const productsResult = await productRepository.find();
          return res.send(productsResult);
        });

        app.post(
          "/api/products/:id/likes",
          async (req: Request, res: Response) => {
            try {
              const product = await productRepository.findOne(req.params.id);
              if (product) {
                await axios.post(
                  `http://localhost:8000/api/products/${product.admin_id}/likes`,
                  {}
                );
                product.likes++;
                await productRepository.save(product);
                return res.send(product);
              }
            } catch (e) {
              console.log(e);
            }
          }
        );

        console.log("Listening to the port: 8001");
        app.listen(8001);
        process.on("beforeExit", () => {
          connection.close();
        });
      });
    }
  );
});
