import { Request, Response } from 'express';
import { User, Tenant } from '../../domain/models';
import { WorkflowService } from '../../domain/services/workflow.service';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../../shared/errors';
import { JwtPayload } from '../../shared/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';

interface RegisterRequest {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  pin: string;
  tenantName?: string;
}

interface LoginRequest {
  email?: string;
  pin: string;
}

interface ProfileUpdateRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  currentPin?: string;
  newPin?: string;
}

export const register = async (
  req: Request<any, any, RegisterRequest>, 
  res: Response
): Promise<void> => {
  try {
    const { firstName, lastName, phone, email, pin, tenantName } = req.body;

    // Validation
    if (!firstName || !lastName || !phone || !email || !pin) {
      throw new BadRequestError('All fields are required');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new BadRequestError('Email already exists');
    }

    // Create a new Tenant (first user becomes owner)
    const tName = tenantName || `${firstName}'s Organization`;
    const tenant = new Tenant({ name: tName });
    await tenant.save();

    // Seed default workflows for this new tenant
    const workflowService = new WorkflowService();
    await workflowService.seedDefaultWorkflows(tenant.tenantId);

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

    // Generate JWT
    const token = jwt.sign(
      { userId: user.userId, tenantId: user.tenantId, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
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
    throw error;
  }
};

export const login = async (
  req: Request<any, any, LoginRequest>, 
  res: Response
): Promise<void> => {
  try {
    const { email, pin } = req.body;

    if (!pin) {
      throw new BadRequestError('PIN is required');
    }

    let user;
    if (email) {
      user = await User.findOne({ email });
    } else {
      // PIN-only login fallback (assumes PIN is unique enough across all users, though not ideal)
      // Since PIN is hashed, we actually can't easily find a user by raw PIN without checking all.
      // We will require email for proper login in this robust system.
      throw new BadRequestError('Email is required for login');
    }

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user.userId, tenantId: user.tenantId, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
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
    throw error;
  }
};

export const getProfile = async (
  req: Request, 
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      throw new UnauthorizedError('Invalid token');
    }

    const user = await User.findOne({ userId }).select('-pin');
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    const tenant = await Tenant.findOne({ tenantId });
    
    res.json({ 
      success: true, 
      user: { ...user.toObject(), tenantName: tenant?.name }
    });
  } catch (error) {
    throw error;
  }
};

export const updateProfile = async (
  req: Request<any, any, ProfileUpdateRequest>, 
  res: Response
): Promise<void> => {
  try {
    const { firstName, lastName, phone, currentPin, newPin } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      throw new UnauthorizedError('Invalid token');
    }

    const user = await User.findOne({ userId });
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;

    if (currentPin && newPin) {
      const isMatch = await bcrypt.compare(currentPin, user.pin);
      if (!isMatch) {
        throw new BadRequestError('Incorrect current PIN');
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
    throw error;
  }
};
