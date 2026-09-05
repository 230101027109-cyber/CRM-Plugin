const User = require('../models/User');
const Tenant = require('../models/Tenant');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { seedDefaultWorkflows } = require('./workflowController');

const register = async (req, res) => {
  try {
    const { firstName, lastName, phone, email, pin, tenantName } = req.body;

    if (!firstName || !lastName || !phone || !email || !pin) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    // Create a new Tenant (first user becomes owner)
    const tName = tenantName || `${firstName}'s Organization`;
    const tenant = new Tenant({ name: tName });
    await tenant.save();

    // Create Stripe Customer
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const customer = await stripe.customers.create({
      email,
      name: tName,
      metadata: {
        tenantId: tenant.tenantId,
        firstName,
        lastName,
      },
    });

    tenant.stripeCustomerId = customer.id;
    await tenant.save();

    // Seed default workflows for this new tenant
    await seedDefaultWorkflows(tenant.tenantId);

    // Hash PIN
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(pin, salt);

    // Create User
    const user = new User({
      tenantId: tenant.tenantId,
      firstName,
      lastName,
      email,
      phone,
      pin: hashedPin,
      role: 'owner',
    });
    await user.save();

    // Update Tenant with ownerId
    tenant.ownerId = user._id;
    await tenant.save();

    // Create free trial subscription
    const Subscription = require('../models/Subscription');
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    await Subscription.create({
      tenantId: tenant.tenantId,
      planId: 'free',
      status: 'trialing',
      billingCycle: 'none',
      stripeCustomerId: customer.id,
      trialStart: new Date(),
      trialEnd,
      history: [{
        planId: 'free',
        status: 'trialing',
        changedAt: new Date(),
        reason: 'Registration — 30-day free trial started',
      }],
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.userId, tenantId: user.tenantId, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        userId: user.userId,
        tenantId: user.tenantId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

const login = async (req, res) => {
  try {
    const { email, pin } = req.body;

    if (!pin) {
      return res.status(400).json({ success: false, message: 'PIN is required' });
    }

    let user;
    if (email) {
      user = await User.findOne({ email });
    } else {
      // PIN-only login fallback (assumes PIN is unique enough across all users, though not ideal)
      // Since PIN is hashed, we actually can't easily find a user by raw PIN without checking all.
      // We will require email for proper login in this robust system.
      return res.status(400).json({ success: false, message: 'Email is required for login' });
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user.userId, tenantId: user.tenantId, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        userId: user.userId,
        tenantId: user.tenantId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId }).select('-pin');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const tenant = await Tenant.findOne({ tenantId: req.user.tenantId });
    
    res.json({ 
      success: true, 
      user: { ...user.toObject(), tenantName: tenant?.name }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching profile' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, currentPin, newPin } = req.body;
    const user = await User.findOne({ userId: req.user.userId });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;

    if (currentPin && newPin) {
      const isMatch = await bcrypt.compare(currentPin, user.pin);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Incorrect current PIN' });
      }
      const salt = await bcrypt.genSalt(10);
      user.pin = await bcrypt.hash(newPin, salt);
    }

    await user.save();
    
    // Return user without pin
    const userObj = user.toObject();
    delete userObj.pin;
    
    res.json({ success: true, user: userObj });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile
};
