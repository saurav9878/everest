import { app } from "./app";
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { getCurrenciesInUsd } from "./helpers/coinmarketcap";
import { ObjectId } from "mongodb";
import { verifyToken } from "./helpers/validate-jwt";
import axios from "axios";

const prisma = new PrismaClient();

/**
 * This endpoint can be used to get the currencies supported by the server
 */
app.get("/currencies", async (req: Request, res: Response) => {
  const { limit, cursor } = req.query;

  const currencies = await prisma.currency.findMany({
    take: parseInt(limit as string) || 100,
    ...(cursor && {
      skip: 1,
      cursor: {
        id: cursor as string,
      },
    }),
  });

  if (currencies) {
    return res.send({
      error: false,
      data: currencies,
    });
  }

  res.status(404);
  return res.send({
    error: true,
    data: "No currencies found",
  });
});

/**
 * This endpoint can be used to get the items in the inventory in the desired cryptocurrency
 */
app.get("/items", async (req: Request, res: Response) => {
  try {
    const { currencyId, limit, cursor } = req.query;

    // check whether currencyId is a MongoDB ObjectID
    if (!ObjectId.isValid(currencyId as unknown as ObjectId)) {
      throw new Error("invalid_currency");
    }

    // Cursor represents an element's ID in MongoDB
    if (cursor && !ObjectId.isValid(cursor as unknown as ObjectId)) {
      throw new Error("invalid_cursor");
    }

    // Query items in a paginated form with default limit as 100
    const items = await prisma.item.findMany({
      take: parseInt(limit as string) || 100,
      ...(cursor && {
        /**
         * skip = 1 as one element is skipped to discard the cursor element which
         * otherwise will be included in the result.
         */
        skip: 1,
        cursor: {
          id: cursor as string,
        },
      }),
      include: {
        currency: true,
      },
    });

    const currency = await prisma.currency.findFirst({
      where: {
        id: currencyId as string,
      },
    });

    if (!currency) {
      throw new Error("invalid_currency");
    }

    // Fetch user requested currency latest value in USD
    const requestedCurrencyQuote = await getCurrenciesInUsd([currency]);
    const requestedCurrencyInUsd = Object.values(
      requestedCurrencyQuote
    )[0] as number;

    if (items) {
      const prices = await getCurrenciesInUsd(
        items.map((item) => item.currency)
      );

      return res.send({
        error: false,
        data: items.map((item) => ({
          ...item,
          price:
            item.price *
            ((prices[item.currencyId] as number) / requestedCurrencyInUsd),
          currency: currency,
          currencyId: currency.id as string,
        })),
      });
    }

    throw new Error("empty_inventory");
  } catch (error: any) {
    switch (error?.message) {
      case "invalid_currency":
        res.status(400);

        res.send({
          error: true,
          data: "Missing / Invalid currencyId in the query params",
        });
        break;

      case "invalid_cursor":
        res.status(400);
        res.send({
          error: true,
          data: "Invalid cursor. Consider using Id of the last element of the items array to view the next page",
        });
        break;

      case "empty_inventory":
        res.status(404);
        res.send({
          error: true,
          data: "Inventory is empty.",
        });

      default:
        res.status(500);
        res.send({
          error: true,
          data: "Something went wrong" + error,
        });
        break;
    }
  }
});

/**
 * This is a protected endpoint to be used by admin to update items quantity and pricing
 * in the standard currency format in which items are already listed in the inventory
 * Limitation: currency change of items is not supported yet.
 */
app.patch("/items", async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    const jwtToken = req.headers.authorization?.split(" ")[1];

    if (!jwtToken) {
      throw new Error("protected_endpoint");
    }

    const payload: any = await verifyToken(jwtToken as string);

    const user = await prisma.user.findFirst({
      where: {
        id: payload?.userId,
      },
    });

    if (!user || !user.isAdmin) {
      throw new Error("admin_user_not_found");
    }

    const promises = items.map(
      (item: { id: string; quantity: number; price: number }) => {
        return prisma.item.update({
          where: {
            id: item.id,
          },
          data: {
            quantity: item.quantity,
            price: item.price,
          },
        });
      }
    );

    // update all items in a transaction
    await prisma.$transaction(promises);

    res.send({
      error: false,
      data: "success",
    });
  } catch (error: any) {
    switch (error?.message) {
      case "protected_endpoint":
        res.status(401);
        res.send({
          error: true,
          data: "Missing / Invalid bearer token in the authorization header",
        });
        break;
      case "admin_user_not_found":
        res.status(401);
        res.send({
          error: true,
          data: "Only admin user can access this endpoint",
        });
        break;
      default:
        break;
    }
  }
});

/**
 * This endpoint can be used to execute a purchase order
 * Limitation: Add multiple items to a single order (like a shopping cart) isn't supported yet
 */
app.post("/order", async (req: Request, res: Response) => {
  try {
    const { itemId, quantity } = req.body;

    if (!itemId || !quantity) {
      throw new Error("missing_fields");
    }

    const jwtToken = req.headers.authorization?.split(" ")[1];

    if (!jwtToken) {
      throw new Error("protected_endpoint");
    }

    const payload: any = await verifyToken(jwtToken as string);

    const user = await prisma.user.findFirst({
      where: {
        id: payload?.userId,
      },
    });

    if (!user) {
      throw new Error("user_not_found");
    }

    // check whether items are available or not
    const item = await prisma.item.findFirst({
      where: {
        id: itemId,
      },
      include: {
        currency: true,
      },
    });

    if (item && item.quantity >= quantity) {
      // execute crypto transaction
      const { data } = await axios.post(
        "https://172ff5dd-6700-4176-835b-8d746706b71e.mock.pstmn.io/transact",
        {
          receiverAddress: "<our-crypto-wallet-address>",
          currencyId: item.currency.externalCurrencyId,
          amount: item.price * quantity,
          signature: "<digital-signature>",
        }
      );

      if (data.verified) {
        // validated transaction

        const createOrder = prisma.order.create({
          data: {
            amount: item.price * quantity,
            quantity: quantity,
            userId: user.id,
            currencyId: item.currencyId,
            itemId: item.id,
          },
        });

        const updateItem = prisma.item.update({
          where: {
            id: item.id,
          },
          data: {
            quantity: item.quantity - quantity,
          },
        });

        await prisma.$transaction([createOrder, updateItem]);

        return res.send({
          error: false,
          data: "success",
        });
      }
      throw new Error("invalid_wallet_transaction");
    }
  } catch (error: any) {
    switch (error?.message) {
      case "user_not_found":
        res.status(400);
        res.send({
          error: true,
          data: "User not found",
        });

        break;
      case "missing_fields":
        res.status(400);
        res.send({
          error: true,
          data: "Missing fields in the request. Check if itemId and quantity are present in the request body",
        });
        break;
      case "invalid_wallet_transaction":
        res.status(403);
        res.send({
          error: true,
          data: "Invalid wallet transaction. Check if you have the minimum amount in wallet to transact",
        });
      default:
        break;
    }
  }
});

/**
 * This endpoint is used to retrieve the order history of a user
 */
app.get("/orders", async (req: Request, res: Response) => {
  try {
    const jwtToken = req.headers.authorization?.split(" ")[1];

    if (!jwtToken) {
      throw new Error("protected_endpoint");
    }

    const payload: any = await verifyToken(jwtToken as string);

    const user = await prisma.user.findFirst({
      where: {
        id: payload?.userId,
      },
    });

    if (!user) {
      throw new Error("user_not_found");
    }

    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
      },
      include: {
        currency: true,
      },
    });

    if (orders.length) {
      return res.send({
        error: false,
        data: orders,
      });
    }
  } catch (error) {
    console.log(error);
  }
});
