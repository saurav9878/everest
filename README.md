# Everest

Everest powers a digital marketplace that enables users to purchase items using cryptocurrency.

## Features

- The marketplace will host multiple items similar to an ecommerce store.
- Allow users to view the available items - their quantity and price in the specified cryptocurrency.
- Enable users to purchase items using cryptocurrency of their choice.

## Context

To make a purchase:

- A user will send a cryptocurrency transaction to a specified endpoint.
- This transaction must be validated before any updates are made to the inventory.
- Note: While the process suggests a cryptocurrency transaction, in practice, this can be a simulated (mocked) transaction.

## Requirements

### Functional requirements

- Fetch the latest values of cryptocurrency from CoinMarketCap API
- Create an API to list the items - quantity and price in any user specified cryptocurrency
- Create an API to execute a purchase from the marketplace
- Create admin only APIs to update the quantity and price of items
- Create an API to get the list of previously ordered items.
- The crypto transaction in the purchase can be simulated for our use case. Eg. a postman mock server
- Tackle the rate limit of 3rd party APIs like CoinMarketCap APIs

### Non-functional requirements

- Deploy on AWS and provide a live API to test out
- Docker compose with 2 replica of the same service and 1 LB with a MongoDB

## Considerations / Assumptions

- An order can contain only one item type. Cart functionality is not supported yet.
- Cryptocurrency prices are updated every minute. A transaction once executed cannot be reversed.
- USD is taken as a standard currency for conversions instead of using convert API of CoinMarketCap to limit the number of 3rd party API calls.
- We are storing orders / transactions across different currencies in the table, reconcilation relation transformations does not happen at the database layer.
- Crypto currency symbols are not unique. Eg. HOT refers to more than one currency. So, use external currency id like coinMarketCap currency Id to distinguish the currencies.

## File navigation

```
├── Dockerfile
├── jobs
│   └── sync-coins.ts // contain a scheduled job to be run as a separate node process
├── package.json
├── package-lock.json
├── Postman Collections
│   └── playbook.json // a collection that can be imported in Postman to call the APIs locally
├── prisma // hosts DB files
│   ├── schema.prisma
│   └── seed.ts
├── README.md
├── scripts
│   └── generate-admin-token.ts // script to generate jwt token
├── src // source code
│   ├── app.ts
│   ├── helpers
│   ├── index.ts
│   ├── redis.ts
│   └── routes.ts
└── tsconfig.json
```

## Notes

#### Purchase workflow

[![Screenshot-from-2024-02-12-22-37-10.png](https://i.postimg.cc/qq0f8PGs/Screenshot-from-2024-02-12-22-37-10.png)](https://postimg.cc/Q96nDnwC)

#### Database design

[![Screenshot-from-2024-02-12-22-56-40.png](https://i.postimg.cc/L5zxVhs5/Screenshot-from-2024-02-12-22-56-40.png)](https://postimg.cc/dZVRssrc)

#### Cache design

[![Screenshot-from-2024-02-12-22-51-57.png](https://i.postimg.cc/W4WtY7yq/Screenshot-from-2024-02-12-22-51-57.png)](https://postimg.cc/2qWzVnrC)

#### Cross chain crypto transactions

[![Screenshot-from-2024-02-12-22-50-23.png](https://i.postimg.cc/X7Vx9j9H/Screenshot-from-2024-02-12-22-50-23.png)](https://postimg.cc/8s0hSVKM)
