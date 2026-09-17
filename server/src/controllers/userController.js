const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users' });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'SENDER',
      },
      select: { id: true, name: true, email: true, role: true },
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error creating user' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { name, email, role, isActive } = req.body;
    
    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: { name, email, role, isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error updating user' });
  }
};

const deleteUser = async (req, res) => {
  try {
    // Instead of actual delete, we can deactivate, or really delete
    await prisma.user.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user' });
  }
};

const getSenders = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'SENDER' },
      select: { id: true, name: true, email: true, role: true },
    });
    // If admin is also a sender conceptually, they might want to send themselves, 
    // but typically they'd pick a sender.
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching senders' });
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser, getSenders };
