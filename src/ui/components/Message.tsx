import React from "react";
import { EnhancedChatMessage } from "../../types/ux";
import TransparencyPanel from "./TransparencyPanel";

interface MessageProps {
  message: EnhancedChatMessage;
}

const MessageComponent: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === "user";

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1`}>
      <div
        className={`max-w-[90%] p-4 rounded-2xl shadow-sm ${
          isUser 
            ? "bg-blue-600 text-white rounded-tr-none" 
            : "bg-gray-800 text-gray-100 border border-gray-700 rounded-tl-none"
        }`}
      >
        <div className="prose prose-invert max-w-none">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
        
        {!isUser && (
          <TransparencyPanel message={message} />
        )}
      </div>
      
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
          {isUser ? "You" : "Omni One"}
        </span>
        <span className="text-[10px] text-gray-600">•</span>
        <span className="text-[10px] text-gray-600">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};

export default MessageComponent;
