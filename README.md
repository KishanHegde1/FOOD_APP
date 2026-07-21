<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Local development

Create `.env` from `.env.example`, then set your local PostgreSQL, Firebase,
and Razorpay values. Local development defaults to port `3001`.

```bash
npm install
npm run start:dev
```

The backend listens on `0.0.0.0` and exposes Swagger at:

```text
http://localhost:3001/api/docs
```

## Production build

```bash
npm run build
npm run start:prod
```

## Health checks

Render and uptime probes can use:

```text
GET /api/health
GET /api/health/ready
```

The health response verifies database connectivity with a lightweight query and
does not expose database credentials or connection details.

## Render deployment

Recommended Render settings:

- Region: Singapore
- Runtime: Node
- Branch: main
- Root Directory: empty
- Build Command: `npm ci && npm run build`
- Start Command: `npm run start:prod`
- Health Check Path: `/api/health`
- Instance: Free for testing

Render supplies `PORT`, so do not set it manually in production.

Required Render environment variables:

```bash
NODE_ENV=production
DATABASE_URL=<Neon PostgreSQL connection string>
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
FIREBASE_SERVICE_ACCOUNT_PATH=/etc/secrets/firebase-service-account.json
RAZORPAY_KEY_ID=<Razorpay key ID>
RAZORPAY_KEY_SECRET=<Razorpay key secret>
RAZORPAY_WEBHOOK_SECRET=<Razorpay webhook secret>
CORS_ORIGIN=
STORAGE_DRIVER=local
```

For Firebase Admin on Render, add a Secret File:

- Filename: `firebase-service-account.json`
- Contents: complete Firebase service account JSON
- Runtime path: `/etc/secrets/firebase-service-account.json`

Neon is configured through `DATABASE_URL`; TypeORM `synchronize` remains
disabled, and schema changes continue to use migrations.

Deploy updates with:

```bash
git add .
git commit -m "Update backend"
git push origin main
```

Render can redeploy automatically from the connected `main` branch.

## Dine-In Razorpay configuration

Module 14 uses Razorpay Standard Checkout for Dine-In UPI and card payments.
Configure these server-only variables outside version control before initiating
online payments:

```bash
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

Configure Razorpay to send `payment.captured`, `payment.failed`, and
`order.paid` webhooks to `POST /api/webhooks/razorpay`. The endpoint verifies
the raw body signature and uses Razorpay's event ID for replay protection.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
