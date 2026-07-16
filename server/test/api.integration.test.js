process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-not-used-outside-tests';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';

const jwt = require('jsonwebtoken');
const http = require('http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const { Server: SocketServer } = require('socket.io');
const { io: createSocketClient } = require('socket.io-client');

const app = require('../src/app');
const Group = require('../src/models/Group');
const Message = require('../src/models/Message');
const Pet = require('../src/models/Pet');
const Post = require('../src/models/Post');
const User = require('../src/models/User');
const { createMessage, ensureValidReceiver } = require('../src/controllers/messageController');
const registerChatSocket = require('../src/sockets/chatSocket');

let mongoServer;

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
const tokenFor = (user, options = {}) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h', ...options });

const createUser = (suffix, extra = {}) =>
  User.create({
    username: `User ${suffix}`,
    email: `${suffix}@example.com`,
    password: 'password123',
    ...extra
  });

const makeFriends = async (first, second) => {
  await Promise.all([
    User.updateOne({ _id: first._id }, { $addToSet: { friends: second._id } }),
    User.updateOne({ _id: second._id }, { $addToSet: { friends: first._id } })
  ]);
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
  await Promise.all([
    Message.deleteMany(),
    Post.deleteMany(),
    Group.deleteMany(),
    Pet.deleteMany(),
    User.deleteMany()
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('authentication', () => {
  test('public registration rejects a client-supplied privileged role', async () => {
    const response = await request(app).post('/api/auth/register').send({
      username: 'Escalation Attempt',
      email: 'escalation@example.com',
      password: 'password123',
      role: 'groupAdmin'
    });

    expect(response.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });

  test('registers a normal user and never returns a password', async () => {
    const response = await request(app).post('/api/auth/register').send({
      username: 'New User',
      email: 'NEW.USER@example.com',
      password: 'password123'
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({ email: 'new.user@example.com', role: 'user' });
    expect(response.body.user.password).toBeUndefined();
    expect(response.body.token).toBeTruthy();
  });

  test('logs in with valid credentials', async () => {
    await createUser('login');
    const response = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'password123'
    });
    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
  });

  test.each([
    ['malformed', 'not-a-jwt'],
    ['expired', jwt.sign({ id: new mongoose.Types.ObjectId() }, process.env.JWT_SECRET, { expiresIn: -1 })]
  ])('rejects %s JWTs', async (label, token) => {
    const response = await request(app).get('/api/pets/my').set(authHeader(token));
    expect(response.status).toBe(401);
  });
});

describe('ownership, permissions, and privacy', () => {
  test('prevents pet and post updates by another user', async () => {
    const owner = await createUser('owner');
    const attacker = await createUser('attacker');
    const pet = await Pet.create({ name: 'Owned Pet', type: 'dog', owner: owner._id });
    const post = await Post.create({ content: 'Owned post', author: owner._id });

    const petResponse = await request(app)
      .put(`/api/pets/${pet._id}`)
      .set(authHeader(tokenFor(attacker)))
      .field('name', 'Changed');
    const postResponse = await request(app)
      .put(`/api/posts/${post._id}`)
      .set(authHeader(tokenFor(attacker)))
      .field('content', 'Changed');

    expect(petResponse.status).toBe(403);
    expect(postResponse.status).toBe(403);
  });

  test('allows only the group admin to update a group', async () => {
    const admin = await createUser('group-admin');
    const member = await createUser('group-member');
    const group = await Group.create({
      name: 'Admin Group', category: 'general', admin: admin._id,
      members: [admin._id, member._id]
    });
    const response = await request(app)
      .put(`/api/groups/${group._id}`)
      .set(authHeader(tokenFor(member)))
      .send({ name: 'Unauthorized Change' });
    expect(response.status).toBe(403);
  });

  test('returns only minimal private-group data to unrelated users', async () => {
    const admin = await createUser('private-admin');
    const member = await createUser('private-member');
    const unrelated = await createUser('private-outsider');
    const group = await Group.create({
      name: 'Private Group', description: 'Sensitive description', category: 'health',
      isPrivate: true, admin: admin._id, members: [admin._id, member._id]
    });

    const outsiderResponse = await request(app)
      .get(`/api/groups/${group._id}`)
      .set(authHeader(tokenFor(unrelated)));
    const memberResponse = await request(app)
      .get(`/api/groups/${group._id}`)
      .set(authHeader(tokenFor(member)));

    expect(outsiderResponse.status).toBe(200);
    expect(outsiderResponse.body.group.description).toBeUndefined();
    expect(outsiderResponse.body.group.members).toEqual([]);
    expect(memberResponse.body.group.description).toBe('Sensitive description');
  });

  test('blocks unrelated users from private-group posts', async () => {
    const admin = await createUser('post-admin');
    const unrelated = await createUser('post-outsider');
    const group = await Group.create({
      name: 'Private Posts', category: 'general', isPrivate: true,
      admin: admin._id, members: [admin._id]
    });
    const post = await Post.create({ content: 'Secret post', author: admin._id, group: group._id });
    const response = await request(app)
      .get(`/api/posts/${post._id}`)
      .set(authHeader(tokenFor(unrelated)));
    expect(response.status).toBe(403);
  });
});

describe('group manager search and expanded deletion', () => {
  const createManagerSearchFixture = async () => {
    const admin = await createUser('manager-search-admin');
    const activeMember = await createUser('manager-search-active', {
      username: 'Active [Alice]'
    });
    const quietMember = await createUser('manager-search-quiet', {
      username: 'Quiet Bob'
    });
    const pendingUser = await createUser('manager-search-pending', {
      username: 'Pending Cara'
    });
    const outsider = await createUser('manager-search-outsider');
    const group = await Group.create({
      name: 'Manager Search Group',
      category: 'general',
      isPrivate: true,
      admin: admin._id,
      members: [admin._id, activeMember._id, quietMember._id],
      pendingRequests: [pendingUser._id]
    });

    await Post.create([
      {
        content: 'Active January first', author: activeMember._id, group: group._id,
        createdAt: new Date('2026-01-05T12:00:00.000Z')
      },
      {
        content: 'Active January inclusive end', author: activeMember._id, group: group._id,
        createdAt: new Date('2026-01-15T23:59:59.000Z')
      },
      {
        content: 'Active February', author: activeMember._id, group: group._id,
        createdAt: new Date('2026-02-10T12:00:00.000Z')
      },
      {
        content: 'Admin January', author: admin._id, group: group._id,
        createdAt: new Date('2026-01-02T12:00:00.000Z')
      },
      {
        content: 'Outside this group', author: activeMember._id,
        createdAt: new Date('2026-01-10T12:00:00.000Z')
      }
    ]);

    return { admin, activeMember, quietMember, pendingUser, outsider, group };
  };

  test('allows only the per-group admin to use manager member search', async () => {
    const { admin, activeMember, outsider, group } = await createManagerSearchFixture();
    const endpoint = `/api/groups/${group._id}/members/search`;

    const managerResponse = await request(app)
      .get(endpoint)
      .set(authHeader(tokenFor(admin)));
    const memberResponse = await request(app)
      .get(endpoint)
      .set(authHeader(tokenFor(activeMember)));
    const outsiderResponse = await request(app)
      .get(endpoint)
      .set(authHeader(tokenFor(outsider)));

    expect(managerResponse.status).toBe(200);
    expect(managerResponse.body.members).toHaveLength(4);
    expect(memberResponse.status).toBe(403);
    expect(memberResponse.body.message).toBe('Only the group admin can perform this action');
    expect(outsiderResponse.status).toBe(403);
    expect(outsiderResponse.body.message).toBe('Only the group admin can perform this action');
  });

  test('combines username, status, post-count, and inclusive date filters', async () => {
    const { admin, activeMember, quietMember, pendingUser, group } =
      await createManagerSearchFixture();
    const endpoint = `/api/groups/${group._id}/members/search`;
    const search = (query) => request(app)
      .get(endpoint)
      .query(query)
      .set(authHeader(tokenFor(admin)));

    const unfiltered = await search({});
    const usernameOnly = await search({ username: '[Alice]' });
    const statusOnly = await search({ status: 'pending' });
    const minimumOnly = await search({ minPosts: 3 });
    const maximumOnly = await search({ maxPosts: 0 });
    const startOnly = await search({ startDate: '2026-01-15' });
    const endOnly = await search({ endDate: '2026-01-15' });
    const combined = await search({
      username: 'Active',
      status: 'member',
      minPosts: 2,
      maxPosts: 2,
      startDate: '2026-01-01',
      endDate: '2026-01-31'
    });

    const unfilteredById = new Map(
      unfiltered.body.members.map((member) => [member._id, member])
    );
    expect(unfiltered.status).toBe(200);
    expect(unfilteredById.get(String(activeMember._id))).toMatchObject({
      username: 'Active [Alice]', status: 'member', postCount: 3
    });
    expect(unfilteredById.get(String(quietMember._id))).toMatchObject({
      status: 'member', postCount: 0
    });
    expect(unfilteredById.get(String(pendingUser._id))).toMatchObject({
      status: 'pending', postCount: 0
    });
    expect(usernameOnly.body.members.map((member) => member._id)).toEqual([
      String(activeMember._id)
    ]);
    expect(statusOnly.body.members).toEqual([
      expect.objectContaining({ _id: String(pendingUser._id), status: 'pending', postCount: 0 })
    ]);
    expect(minimumOnly.body.members).toEqual([
      expect.objectContaining({ _id: String(activeMember._id), postCount: 3 })
    ]);
    expect(maximumOnly.body.members.map((member) => member.postCount)).toEqual([0, 0]);
    expect(startOnly.body.members.find((member) => member._id === String(activeMember._id)).postCount)
      .toBe(2);
    expect(endOnly.body.members.find((member) => member._id === String(activeMember._id)).postCount)
      .toBe(2);
    expect(combined.body.members).toEqual([
      expect.objectContaining({
        _id: String(activeMember._id), status: 'member', postCount: 2
      })
    ]);
  });

  test.each([
    ['invalid group id', '/api/groups/not-an-id/members/search', {}],
    ['unknown parameter', null, { unexpected: 'value' }],
    ['invalid status', null, { status: 'removed' }],
    ['negative minimum', null, { minPosts: -1 }],
    ['fractional maximum', null, { maxPosts: 1.5 }],
    ['extreme maximum', null, { maxPosts: 1000001 }],
    ['reversed counts', null, { minPosts: 4, maxPosts: 3 }],
    ['invalid start date', null, { startDate: 'not-a-date' }],
    ['reversed dates', null, { startDate: '2026-02-01', endDate: '2026-01-01' }],
    ['extreme username', null, { username: 'x'.repeat(101) }]
  ])('returns 400 for %s', async (_label, explicitEndpoint, query) => {
    const { admin, group } = await createManagerSearchFixture();
    const endpoint = explicitEndpoint || `/api/groups/${group._id}/members/search`;
    const response = await request(app)
      .get(endpoint)
      .query(query)
      .set(authHeader(tokenFor(admin)));

    expect(response.status).toBe(400);
  });

  test('returns 404 for a valid but non-existent group', async () => {
    const admin = await createUser('missing-manager-group');
    const response = await request(app)
      .get(`/api/groups/${new mongoose.Types.ObjectId()}/members/search`)
      .set(authHeader(tokenFor(admin)));

    expect(response.status).toBe(404);
  });

  test('lets a group admin delete a member post without granting edit permission', async () => {
    const { admin, activeMember, outsider, group } = await createManagerSearchFixture();
    const post = await Post.create({
      content: 'Member-managed post', author: activeMember._id, group: group._id
    });

    const randomDelete = await request(app)
      .delete(`/api/posts/${post._id}`)
      .set(authHeader(tokenFor(outsider)));
    const adminEdit = await request(app)
      .put(`/api/posts/${post._id}`)
      .set(authHeader(tokenFor(admin)))
      .field('content', 'Manager edit attempt');
    const adminDelete = await request(app)
      .delete(`/api/posts/${post._id}`)
      .set(authHeader(tokenFor(admin)));

    expect(randomDelete.status).toBe(403);
    expect(adminEdit.status).toBe(403);
    expect(adminDelete.status).toBe(200);
    expect(await Post.findById(post._id)).toBeNull();
  });
});

describe('friendships, feeds, and chat', () => {
  test('completes the friend request lifecycle reciprocally', async () => {
    const sender = await createUser('request-sender');
    const receiver = await createUser('request-receiver');
    const sendResponse = await request(app)
      .post(`/api/friends/request/${receiver._id}`)
      .set(authHeader(tokenFor(sender)));
    expect(sendResponse.status).toBe(201);

    const acceptResponse = await request(app)
      .post(`/api/friends/accept/${sender._id}`)
      .set(authHeader(tokenFor(receiver)));
    expect(acceptResponse.status).toBe(200);

    const [freshSender, freshReceiver] = await Promise.all([
      User.findById(sender._id), User.findById(receiver._id)
    ]);
    expect(freshSender.friends.map(String)).toContain(String(receiver._id));
    expect(freshReceiver.friends.map(String)).toContain(String(sender._id));
    expect(freshSender.friendRequestsSent).toHaveLength(0);
    expect(freshReceiver.friendRequestsReceived).toHaveLength(0);
  });

  test('friends and groups feeds contain no unrelated posts', async () => {
    const current = await createUser('feed-current');
    const friend = await createUser('feed-friend');
    const unrelated = await createUser('feed-unrelated');
    await makeFriends(current, friend);
    const group = await Group.create({
      name: 'Feed Group', category: 'general', admin: current._id, members: [current._id]
    });
    await Post.create([
      { content: 'Friend post', author: friend._id },
      { content: 'Group post', author: current._id, group: group._id },
      { content: 'Unrelated post', author: unrelated._id }
    ]);

    const friendsResponse = await request(app)
      .get('/api/posts/feed/friends').set(authHeader(tokenFor(current)));
    const groupsResponse = await request(app)
      .get('/api/posts/feed/groups').set(authHeader(tokenFor(current)));
    expect(friendsResponse.body.posts.map((post) => post.content)).toEqual(['Friend post']);
    expect(groupsResponse.body.posts.map((post) => post.content)).toEqual(['Group post']);
  });

  test('blocks non-friend chat and persists the first accepted-friend message', async () => {
    const sender = await createUser('chat-sender');
    const receiver = await createUser('chat-receiver');
    const blocked = await request(app)
      .get(`/api/messages/conversation/${receiver._id}`)
      .set(authHeader(tokenFor(sender)));
    expect(blocked.status).toBe(403);

    await makeFriends(sender, receiver);
    const responseState = { statusCode: 200, status(code) { this.statusCode = code; return this; } };
    await ensureValidReceiver(receiver._id.toString(), sender._id, responseState);
    const message = await createMessage({
      senderId: sender._id, receiverId: receiver._id, text: 'First message'
    });
    expect(message._id).toBeTruthy();
    expect(await Message.countDocuments()).toBe(1);

    const history = await request(app)
      .get(`/api/messages/conversation/${receiver._id}`)
      .set(authHeader(tokenFor(sender)));
    expect(history.status).toBe(200);
    expect(history.body.messages[0].text).toBe('First message');
  });

  test('Socket.io derives the sender from JWT and acknowledges the saved first message', async () => {
    const sender = await createUser('socket-sender');
    const receiver = await createUser('socket-receiver');
    await makeFriends(sender, receiver);

    const httpServer = http.createServer(app);
    const io = new SocketServer(httpServer);
    registerChatSocket(io);
    await new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(0, '127.0.0.1', resolve);
    });

    const client = createSocketClient(`http://127.0.0.1:${httpServer.address().port}`, {
      auth: { token: tokenFor(sender) }, transports: ['websocket'], forceNew: true
    });

    try {
      await new Promise((resolve, reject) => {
        client.once('connect', resolve);
        client.once('connect_error', reject);
      });
      const acknowledgement = await new Promise((resolve) => {
        client.emit('sendMessage', {
          sender: receiver._id.toString(),
          receiver: receiver._id.toString(),
          text: 'Socket first message'
        }, resolve);
      });

      expect(acknowledgement.ok).toBe(true);
      expect(String(acknowledgement.message.sender._id)).toBe(String(sender._id));
      expect(acknowledgement.message._id).toBeTruthy();
      expect(await Message.countDocuments()).toBe(1);
    } finally {
      client.removeAllListeners();
      client.close();
      await new Promise((resolve) => io.close(resolve));
    }
  });
});

describe('input and upload hardening', () => {
  test('rejects malformed IDs and empty updates', async () => {
    const user = await createUser('validation');
    const malformed = await request(app)
      .put('/api/pets/not-an-id')
      .set(authHeader(tokenFor(user)))
      .send({ name: 'Nope' });
    const pet = await Pet.create({ name: 'Pet', type: 'cat', owner: user._id });
    const empty = await request(app)
      .put(`/api/pets/${pet._id}`)
      .set(authHeader(tokenFor(user)))
      .send({});
    expect(malformed.status).toBe(400);
    expect(empty.status).toBe(400);
  });

  test('treats regex search characters literally', async () => {
    const user = await createUser('regex');
    await Pet.create({ name: 'Literal', type: 'dog', breed: '[abc', owner: user._id });
    await Pet.create({ name: 'Other', type: 'dog', breed: 'Golden', owner: user._id });
    const response = await request(app)
      .get('/api/pets/search')
      .query({ breed: '[abc' })
      .set(authHeader(tokenFor(user)));
    expect(response.status).toBe(200);
    expect(response.body.pets.map((pet) => pet.name)).toEqual(['Literal']);
  });

  test('rejects unsupported media MIME types', async () => {
    const user = await createUser('upload');
    const response = await request(app)
      .post('/api/pets')
      .set(authHeader(tokenFor(user)))
      .field('name', 'Upload Pet')
      .field('type', 'dog')
      .attach('image', Buffer.from('not an image'), {
        filename: 'payload.txt', contentType: 'text/plain'
      });
    expect(response.status).toBe(400);
    expect(await Pet.countDocuments()).toBe(0);
  });
});

describe('dynamic statistics', () => {
  test('builds chart data from MongoDB and excludes inaccessible private groups', async () => {
    const user = await createUser('stats-user');
    const outsider = await createUser('stats-outsider');
    const pet = await Pet.create({ name: 'Stats Pet', type: 'dog', owner: user._id });
    const privateGroup = await Group.create({
      name: 'Hidden Stats', category: 'health', isPrivate: true,
      admin: user._id, members: [user._id]
    });
    await Post.create([
      { content: 'January activity', author: user._id, pet: pet._id, group: privateGroup._id, createdAt: new Date('2026-01-10T12:00:00Z'), likes: [outsider._id] },
      { content: 'February activity', author: user._id, createdAt: new Date('2026-02-10T12:00:00Z') }
    ]);

    const personal = await request(app)
      .get('/api/stats/my-activity').set(authHeader(tokenFor(user)));
    const outsiderGroups = await request(app)
      .get('/api/stats/posts-per-group').set(authHeader(tokenFor(outsider)));

    expect(personal.status).toBe(200);
    expect(personal.body.stats).toMatchObject({ petsCount: 1, postsCount: 2, totalLikesReceived: 1 });
    expect(personal.body.stats.postsPerMonth).toHaveLength(2);
    expect(outsiderGroups.body.stats).toEqual([]);
  });
});
