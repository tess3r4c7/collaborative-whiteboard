const mongoose = require("mongoose");

const strokeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  userId: { type: String, required: true },
  points: [{ x: Number, y: Number }],
  color: { type: String, required: true },
  width: { type: Number, required: true },
}, { _id: false });

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  strokes: {
    type: [strokeSchema],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

roomSchema.pre("save", function () {
  this.updatedAt = new Date();
});

module.exports = mongoose.model("Room", roomSchema);
