/**
 * FeedbackButtons — Omni One Frontend
 * 
 * Allows users to rate AI responses with 👍/👎 and provide comments.
 */

import React, { useState } from "react";
import { useChatStore } from "../../../store/useChatStore";

interface FeedbackButtonsProps {
  messageId: string;
  conversationId: string;
  model?: string;
  provider?: string;
}

export const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({
  messageId,
  conversationId,
  model,
  provider,
}) => {
  const [rating, setRating] = useState<number | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleRate = async (value: number) => {
    setRating(value);
    setShowComment(true);
    
    // Auto-submit rating immediately
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          conversationId,
          rating: value,
          model,
          provider,
        }),
      });
    } catch (err) {
      console.error("Failed to submit rating", err);
    }
  };

  const handleSubmitComment = async () => {
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          conversationId,
          rating: rating || 0,
          comment,
          model,
          provider,
        }),
      });
      setIsSubmitted(true);
      setShowComment(false);
    } catch (err) {
      console.error("Failed to submit comment", err);
    }
  };

  if (isSubmitted) {
    return <span className="text-[10px] text-ink-500 italic px-2">Thank you for your feedback!</span>;
  }

  return (
    <div className="flex flex-col gap-2 mt-2 px-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleRate(1)}
          className={`p-1.5 rounded-lg transition-colors ${
            rating === 1 ? "bg-green-500/20 text-green-400" : "hover:bg-ink-800 text-ink-500"
          }`}
          title="Good response"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.757c1.246 0 2.256 1.01 2.256 2.256 0 .359-.085.714-.247 1.036l-3.032 6.064a2.256 2.256 0 01-2.018 1.244H7.5a2.25 2.25 0 01-2.25-2.25V10c0-.621.25-1.216.696-1.656L12 2.25l1.32 1.32c.313.313.48.74.463 1.184L13.5 10z" />
          </svg>
        </button>
        <button
          onClick={() => handleRate(-1)}
          className={`p-1.5 rounded-lg transition-colors ${
            rating === -1 ? "bg-red-500/20 text-red-400" : "hover:bg-ink-800 text-ink-500"
          }`}
          title="Bad response"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.243c-1.246 0-2.256-1.01-2.256-2.256 0-.359.085-.714.247-1.036l3.032-6.064a2.256 2.256 0 012.018-1.244H16.5a2.25 2.25 0 012.25 2.25V14c0 .621-.25 1.216-.696 1.656L12 21.75l-1.32-1.32c-.313-.313-.48-.74-.463-1.184L10.5 14z" />
          </svg>
        </button>
      </div>

      {showComment && (
        <div className="flex flex-col gap-2 bg-ink-900 border border-ink-800 p-2 rounded-xl animate-in fade-in slide-in-from-top-1">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us more (optional)..."
            className="w-full bg-transparent text-xs text-ink-200 resize-none focus:outline-none min-h-[60px]"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowComment(false)}
              className="px-2 py-1 text-[10px] text-ink-500 hover:text-ink-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitComment}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-medium rounded-lg transition-colors"
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
