const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  process.env.JWT_SECRET = 'test-secret-key-for-jest';
  process.env.PORT = '0'; // random port
  
  // Import app after env vars are set
  // We need to require the app export from server.js
  app = require('../server').app;
  
  // Wait for mongoose connection
  await new Promise(resolve => setTimeout(resolve, 1000));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

describe('GET /api/health', () => {
  it('should return health status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /', () => {
  it('should return running message', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('Backend is running');
  });
});

describe('POST /api/auth/signup', () => {
  it('should create a new user', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'testuser', email: 'test@example.com', password: 'password123' });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('testuser');
  });

  it('should reject duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'testuser2', email: 'test@example.com', password: 'password123' });
    expect(res.statusCode).toBe(400);
  });

  it('should reject duplicate username', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'testuser', email: 'other@example.com', password: 'password123' });
    expect(res.statusCode).toBe(400);
  });

  it('should reject short password', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'newuser', email: 'new@example.com', password: '123' });
    expect(res.statusCode).toBe(400);
  });

  it('should reject missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'newuser' });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('should login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'testuser', password: 'password123' });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should login with email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'test@example.com', password: 'password123' });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'testuser', password: 'wrongpassword' });
    expect(res.statusCode).toBe(401);
  });

  it('should reject nonexistent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'nobody', password: 'password123' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('should return user profile with valid token', async () => {
    // First login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'testuser', password: 'password123' });
    const token = loginRes.body.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.username).toBe('testuser');
  });

  it('should reject request without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('should reject invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken123');
    expect(res.statusCode).toBe(401);
  });
});
