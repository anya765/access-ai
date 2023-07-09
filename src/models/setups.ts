import mongoose from 'mongoose';

const Setups = new mongoose.Schema(
  {
    token: { type: String, index: true, required: true, unique: true },
    response: { type: String, required: false },
    tone: { type: String, required: false },
    document: { type: String, required: false },
    company: { type: String, required: false },
    color: { type: String, required: false, default: '#8D7BAC' },

    createdAt: { type: Date, default: Date.now },
  },
  { strict: true },
);

export default mongoose.model('setups', Setups);
