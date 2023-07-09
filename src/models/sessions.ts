import mongoose from 'mongoose';

const Session = new mongoose.Schema(
  {
    sessionToken: { type: String, index: true, required: true, unique: true },
    setupToken: { type: String, index: true, required: true },
    system: { type: String, default: '' },
    user: { type: [String], default: [] },
    assistant: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { strict: true },
);

export default mongoose.model('sessions', Session);
