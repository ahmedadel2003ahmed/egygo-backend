import mongoose from "mongoose";

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    category: {
      type: String,
      default: "general",
    },
    keywords: [String],
  },
  {
    timestamps: true,
  }
);

// Index for text search if needed later, but regex will be used per task
faqSchema.index({ question: "text" });

const Faq = mongoose.model("Faq", faqSchema);

export default Faq;
