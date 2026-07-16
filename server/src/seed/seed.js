const dotenv = require('dotenv');
const mongoose = require('mongoose');

const Group = require('../models/Group');
const Message = require('../models/Message');
const Pet = require('../models/Pet');
const Post = require('../models/Post');
const User = require('../models/User');

dotenv.config();

const DEMO_PASSWORD = 'password123';
const monthsAgo = (months, day = 10) => {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() - months, day);
  date.setUTCHours(12, 0, 0, 0);
  return date;
};

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not defined');
  }

  await mongoose.connect(process.env.MONGO_URI);
};

const clearData = async () => {
  await Promise.all([
    Message.deleteMany(),
    Post.deleteMany(),
    Group.deleteMany(),
    Pet.deleteMany(),
    User.deleteMany()
  ]);
};

const createUsers = async () => {
  const users = await User.create([
    {
      username: 'Maya Cohen',
      email: 'maya@example.com',
      password: DEMO_PASSWORD,
      role: 'groupAdmin'
    },
    {
      username: 'Noam Levy',
      email: 'noam@example.com',
      password: DEMO_PASSWORD,
      role: 'groupAdmin'
    },
    {
      username: 'Dana Azulay',
      email: 'dana@example.com',
      password: DEMO_PASSWORD,
      role: 'groupAdmin'
    },
    {
      username: 'Lior Ben-David',
      email: 'lior@example.com',
      password: DEMO_PASSWORD,
      role: 'user'
    },
    {
      username: 'Tamar Katz',
      email: 'tamar@example.com',
      password: DEMO_PASSWORD,
      role: 'groupAdmin'
    },
    {
      username: 'Ariel Romano',
      email: 'ariel@example.com',
      password: DEMO_PASSWORD,
      role: 'groupAdmin'
    },
    {
      username: 'Shira Gold',
      email: 'shira@example.com',
      password: DEMO_PASSWORD,
      role: 'user'
    },
    {
      username: 'Eitan Bar',
      email: 'eitan@example.com',
      password: DEMO_PASSWORD,
      role: 'user'
    }
  ]);

  const acceptedPairs = [[0, 2], [0, 3], [1, 5], [4, 6], [4, 7]];
  acceptedPairs.forEach(([first, second]) => {
    users[first].friends.push(users[second]._id);
    users[second].friends.push(users[first]._id);
  });

  users[0].friendRequestsSent.push(users[1]._id);
  users[1].friendRequestsReceived.push(users[0]._id);
  users[3].friendRequestsSent.push(users[6]._id);
  users[6].friendRequestsReceived.push(users[3]._id);

  await Promise.all(users.map((user) => user.save()));
  await User.collection.bulkWrite(users.map((user, index) => ({
    updateOne: {
      filter: { _id: user._id },
      update: { $set: { createdAt: monthsAgo(index % 6, 2 + index) } }
    }
  })));

  return users;
};

const createPets = async (users) =>
  Pet.create([
    {
      name: 'Bamba',
      type: 'dog',
      breed: 'Golden Retriever',
      age: 4,
      city: 'Tel Aviv',
      bio: 'Friendly beach walker who loves tennis balls.',
      owner: users[0]._id
    },
    {
      name: 'Mitsi',
      type: 'cat',
      breed: 'Tabby',
      age: 3,
      city: 'Haifa',
      bio: 'Window watcher and professional blanket tester.',
      owner: users[1]._id
    },
    {
      name: 'Kiwi',
      type: 'bird',
      breed: 'Budgie',
      age: 2,
      city: 'Ramat Gan',
      bio: 'Sings when the kettle boils.',
      owner: users[2]._id
    },
    {
      name: 'Luna',
      type: 'dog',
      breed: 'Border Collie',
      age: 5,
      city: 'Jerusalem',
      bio: 'Agility fan looking for weekend playdates.',
      owner: users[3]._id
    },
    {
      name: 'Nuni',
      type: 'rabbit',
      breed: 'Mini Lop',
      age: 1,
      city: 'Netanya',
      bio: 'Tiny explorer with a taste for parsley.',
      owner: users[4]._id
    },
    {
      name: 'Simba',
      type: 'cat',
      breed: 'British Shorthair',
      age: 6,
      city: 'Beer Sheva',
      bio: 'Calm lap cat who approves of quiet guests.',
      owner: users[5]._id
    },
    {
      name: 'Pepper',
      type: 'dog',
      breed: 'Mixed Breed',
      age: 2,
      city: 'Holon',
      bio: 'Rescue pup learning confidence one snack at a time.',
      owner: users[6]._id
    },
    {
      name: 'Olive',
      type: 'other',
      breed: 'Hamster',
      age: 1,
      city: 'Herzliya',
      bio: 'Night runner and sunflower seed specialist.',
      owner: users[7]._id
    },
    {
      name: 'Toto',
      type: 'dog',
      breed: 'Poodle',
      age: 7,
      city: 'Tel Aviv',
      bio: 'Senior gentleman who enjoys slow park walks.',
      owner: users[1]._id
    },
    {
      name: 'Cleo',
      type: 'cat',
      breed: 'Siamese',
      age: 4,
      city: 'Rishon LeZion',
      bio: 'Talkative cat with strong opinions about dinner time.',
      owner: users[3]._id
    }
  ]);

const createGroups = async (users) =>
  Group.create([
    {
      name: 'Tel Aviv Dog Walkers',
      description: 'Daily walks, dog parks, and weekend beach meetups.',
      category: 'dogs',
      isPrivate: false,
      admin: users[0]._id,
      members: [users[0]._id, users[2]._id, users[3]._id, users[6]._id],
      pendingRequests: []
    },
    {
      name: 'Cat Parents Israel',
      description: 'Advice, photos, and support for cat owners.',
      category: 'cats',
      isPrivate: false,
      admin: users[1]._id,
      members: [users[1]._id, users[3]._id, users[5]._id, users[7]._id],
      pendingRequests: []
    },
    {
      name: 'Adoption Helpers',
      description: 'Helping rescued pets find safe homes.',
      category: 'adoption',
      isPrivate: false,
      admin: users[4]._id,
      members: [users[4]._id, users[0]._id, users[6]._id, users[7]._id],
      pendingRequests: []
    },
    {
      name: 'Reactive Dogs Support',
      description: 'Private support group for training and calm routines.',
      category: 'training',
      isPrivate: true,
      admin: users[2]._id,
      members: [users[2]._id, users[0]._id, users[6]._id],
      pendingRequests: [users[3]._id]
    },
    {
      name: 'Pet Health Questions',
      description: 'Wellness reminders, vet prep, and recovery tips.',
      category: 'health',
      isPrivate: true,
      admin: users[5]._id,
      members: [users[5]._id, users[1]._id, users[4]._id],
      pendingRequests: [users[7]._id]
    }
  ]);

const createPosts = async (users, groups, pets) => {
  const posts = [
    {
      content: 'Bamba finally learned to wait before crossing the road. Tiny win, huge relief.',
      author: users[0]._id,
      group: groups[0]._id,
      likes: [users[2]._id, users[3]._id],
      comments: [{ user: users[2]._id, text: 'That is such a big milestone!' }]
    },
    {
      content: 'Anyone free for a dog park meetup near Hayarkon this Friday morning?',
      author: users[3]._id,
      group: groups[0]._id,
      likes: [users[0]._id],
      comments: []
    },
    {
      content: 'Pepper had her first calm cafe visit today. Proud rescue parent moment.',
      author: users[6]._id,
      group: groups[0]._id,
      likes: [users[0]._id, users[2]._id],
      comments: [{ user: users[0]._id, text: 'Pepper is doing amazing.' }]
    },
    {
      content: 'Looking for recommendations for a durable harness for medium dogs.',
      author: users[2]._id,
      group: groups[0]._id,
      likes: [users[3]._id],
      comments: []
    },
    {
      content: 'Mitsi has claimed the laundry basket again. I guess it belongs to her now.',
      author: users[1]._id,
      group: groups[1]._id,
      likes: [users[5]._id, users[7]._id],
      comments: [{ user: users[5]._id, text: 'Classic cat real estate move.' }]
    },
    {
      content: 'What wet food brands worked best for sensitive stomachs?',
      author: users[5]._id,
      group: groups[1]._id,
      likes: [users[1]._id],
      comments: []
    },
    {
      content: 'Cleo has started greeting guests at the door like a tiny host.',
      author: users[3]._id,
      group: groups[1]._id,
      likes: [users[1]._id, users[7]._id],
      comments: []
    },
    {
      content: 'Reminder: keep lilies far away from cats. Even small exposure can be dangerous.',
      author: users[7]._id,
      group: groups[1]._id,
      likes: [users[1]._id, users[5]._id],
      comments: [{ user: users[1]._id, text: 'Important reminder.' }]
    },
    {
      content: 'Two sweet mixed-breed puppies are ready for foster homes in Holon.',
      author: users[4]._id,
      group: groups[2]._id,
      likes: [users[0]._id, users[6]._id],
      comments: [{ user: users[6]._id, text: 'I can share this with my neighbors.' }]
    },
    {
      content: 'Adoption day checklist: collar, ID tag, quiet room, and patience.',
      author: users[0]._id,
      group: groups[2]._id,
      likes: [users[4]._id],
      comments: []
    },
    {
      content: 'Pepper came from foster care. The first week was slow, but every routine helped.',
      author: users[6]._id,
      group: groups[2]._id,
      likes: [users[4]._id, users[7]._id],
      comments: []
    },
    {
      content: 'Does anyone have spare blankets for a small rescue shelter?',
      author: users[7]._id,
      group: groups[2]._id,
      likes: [users[4]._id],
      comments: [{ user: users[4]._id, text: 'Yes, message me and I will coordinate pickup.' }]
    },
    {
      content: 'Quiet sniff walks have been better for Luna than busy dog parks.',
      author: users[2]._id,
      group: groups[3]._id,
      likes: [users[0]._id],
      comments: []
    },
    {
      content: 'We practiced watching bikes from a distance today. No barking for five minutes.',
      author: users[0]._id,
      group: groups[3]._id,
      likes: [users[2]._id, users[6]._id],
      comments: [{ user: users[6]._id, text: 'Five minutes is huge.' }]
    },
    {
      content: 'Pepper is nervous around scooters. Any gradual exposure tips?',
      author: users[6]._id,
      group: groups[3]._id,
      likes: [users[2]._id],
      comments: []
    },
    {
      content: 'Nuni has a vet check next week. Making a list of questions before we go.',
      author: users[4]._id,
      group: groups[4]._id,
      likes: [users[5]._id],
      comments: []
    },
    {
      content: 'Simba recovered well after dental cleaning. Soft food and calm corners helped.',
      author: users[5]._id,
      group: groups[4]._id,
      likes: [users[1]._id, users[4]._id],
      comments: [{ user: users[1]._id, text: 'Glad Simba is feeling better.' }]
    },
    {
      content: 'Do you track vaccines in a calendar app or on paper?',
      author: users[1]._id,
      group: groups[4]._id,
      likes: [users[5]._id],
      comments: []
    },
    {
      content: 'Kiwi learned a new tune today and now refuses to stop performing.',
      author: users[2]._id,
      likes: [users[0]._id, users[7]._id],
      comments: [{ user: users[7]._id, text: 'A tiny concert star.' }]
    },
    {
      content: 'Olive moved into a larger enclosure and immediately inspected every corner.',
      author: users[7]._id,
      likes: [users[4]._id],
      comments: []
    },
    {
      content: 'Morning reminder: fresh water bowls before coffee.',
      author: users[3]._id,
      likes: [users[0]._id, users[1]._id],
      comments: []
    },
    {
      content: 'Toto enjoyed a slow senior walk today. Older pets deserve gentle adventures too.',
      author: users[1]._id,
      likes: [users[5]._id, users[6]._id],
      comments: [{ user: users[6]._id, text: 'Senior pets are the sweetest.' }]
    }
  ];

  const petByPostIndex = { 0: 0, 2: 6, 4: 1, 6: 9, 12: 3, 15: 4, 16: 5, 18: 2, 19: 7, 21: 8 };
  return Post.create(posts.map((post, index) => ({
    ...post,
    pet: petByPostIndex[index] === undefined ? undefined : pets[petByPostIndex[index]]._id,
    createdAt: monthsAgo(index % 6, 4 + (index % 20))
  })));
};

const createMessages = async (users) => {
  const messages = [
    {
      sender: users[0]._id,
      receiver: users[2]._id,
      text: 'Want to join our Friday dog walk?'
    },
    {
      sender: users[2]._id,
      receiver: users[0]._id,
      text: 'Yes, Bamba and Kiwi will cheer from different corners.'
    },
    {
      sender: users[4]._id,
      receiver: users[6]._id,
      text: 'Can you share the foster post in your neighborhood group?'
    },
    {
      sender: users[6]._id,
      receiver: users[4]._id,
      text: 'Absolutely, sending it now.'
    },
    {
      sender: users[1]._id,
      receiver: users[5]._id,
      text: 'Which dental clinic did Simba visit?'
    },
    {
      sender: users[5]._id,
      receiver: users[1]._id,
      text: 'I will send you the vet details.'
    },
    {
      sender: users[7]._id,
      receiver: users[4]._id,
      text: 'I found two clean blankets for the shelter.'
    },
    {
      sender: users[3]._id,
      receiver: users[0]._id,
      text: 'Luna may join the park meetup if it is not too crowded.'
    },
    {
      sender: users[0]._id,
      receiver: users[3]._id,
      text: 'We will choose the quiet side of the park for Luna.'
    },
    {
      sender: users[4]._id,
      receiver: users[7]._id,
      text: 'Thank you for finding those shelter blankets.'
    },
    {
      sender: users[7]._id,
      receiver: users[4]._id,
      text: 'Happy to help. I can bring them tomorrow evening.'
    },
    {
      sender: users[1]._id,
      receiver: users[5]._id,
      text: 'The clinic recommendation was excellent, thank you.'
    },
    {
      sender: users[5]._id,
      receiver: users[1]._id,
      text: 'Glad it helped. Give Mitsi a scratch from me.'
    },
    {
      sender: users[0]._id,
      receiver: users[2]._id,
      text: 'I posted the final route in the walkers group.'
    },
    {
      sender: users[2]._id,
      receiver: users[0]._id,
      text: 'Perfect, see you Friday morning.'
    },
    {
      sender: users[6]._id,
      receiver: users[4]._id,
      text: 'The foster post already has three shares.'
    }
  ];

  return Message.create(messages.map((message, index) => ({
    ...message,
    createdAt: new Date(Date.now() - (messages.length - index) * 6 * 60 * 60 * 1000)
  })));
};

const importData = async () => {
  await connectDB();
  await clearData();

  const users = await createUsers();
  const pets = await createPets(users);
  const groups = await createGroups(users);
  await createPosts(users, groups, pets);
  await createMessages(users);

  console.log('Seed data imported successfully');
  console.log('Demo credentials (development only):');
  console.log('  maya@example.com / password123');
  console.log('  dana@example.com / password123');
  console.log('  noam@example.com / password123');
  await mongoose.connection.close();
  process.exit(0);
};

const destroyData = async () => {
  await connectDB();
  await clearData();

  console.log('Seed data destroyed successfully');
  await mongoose.connection.close();
  process.exit(0);
};

const run = async () => {
  try {
    if (process.argv[2] === '--destroy') {
      await destroyData();
      return;
    }

    await importData();
  } catch (error) {
    console.error(`Seed failed: ${error.message}`);
    await mongoose.connection.close();
    process.exit(1);
  }
};

run();
