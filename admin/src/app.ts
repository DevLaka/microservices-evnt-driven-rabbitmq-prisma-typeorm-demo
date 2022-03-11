import express, { Request, Response } from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import * as ampqp from "amqplib/callback_api";
import { channel } from "diagnostics_channel";

const { product: productRepository } = new PrismaClient();

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

      app.post(
        "/api/products",
        async (req: Request, res: Response): Promise<any> => {
          const { title, image } = req.body;
          const product = {
            title,
            image,
          };

          try {
            const productsResult = await productRepository.create({
              data: product,
            });
            channel.sendToQueue('product_created', Buffer.from(JSON.stringify(productsResult)));
            res.status(200).send(productsResult);
          } catch (err) {
            res.status(500).send("Error creating a product");
          }
        }
      );

      app.put(
        "/api/products/:id",
        async (req: Request, res: Response): Promise<any> => {
          const { id } = req.params;
          const product = {
            title: req.body.title,
            image: req.body.image,
          };
          try {
            const productsResult = await productRepository.update({
              where: {
                id: parseInt(id),
              },
              data: product,
            });
            channel.sendToQueue('product_updated', Buffer.from(JSON.stringify(productsResult)));
            res.status(200).send(productsResult);
          } catch (err) {
            res.status(500).send("Error updating a product");
          }
        }
      );

      app.delete(
        "/api/products/:id",
        async (req: Request, res: Response): Promise<any> => {
          const { id } = req.params;
          try {
            const productsResult = await productRepository.delete({
              where: { id: parseInt(id) },
            });
            channel.sendToQueue('product_deleted', Buffer.from(JSON.stringify(productsResult.id)));
            res.status(200).send(productsResult);
          } catch (err) {
            res.status(500).send("Error deleting a product");
          }
        }
      );

      app.get(
        "/api/products/:id",
        async (req: Request, res: Response): Promise<any> => {
          const { id } = req.params;
          try {
            const productsResult = await productRepository.findUnique({
              where: { id: parseInt(id) },
            });
            res.status(200).send(productsResult);
          } catch (err) {
            res.status(500).send("Error getting a product");
          }
        }
      );

      app.get(
        "/api/products",
        async (req: Request, res: Response): Promise<any> => {
          try {
            const productsResult = await productRepository.findMany();
            res.status(200).send(productsResult);
          } catch (err) {
            res.status(500).send("Error getting list of products");
          }
        }
      );

      app.post(
        "/api/products/:id/likes",
        async (req: Request, res: Response): Promise<any> => {
          const { id } = req.params;
          try {
            const productsResult = await productRepository.findUnique({
              where: { id: parseInt(id) },
            });
            if (productsResult) {
              const product = {
                title: productsResult.title,
                image: productsResult.image,
                likes: productsResult.likes + 1,
              };
              try {
                const productsUpdateResult = await productRepository.update({
                  where: {
                    id: parseInt(id),
                  },
                  data: product,
                });
                res.status(200).send(productsUpdateResult);
              } catch (err) {
                res.status(500).send("Error liking a product");
              }
            } else {
              res.status(204).send("Product not found");
            }
          } catch (err) {
            res.status(500).send("Error liking a product");
          }
        }
      );

      console.log("Listening to the port: 8000");
      app.listen(8000);
    });
  }
);
