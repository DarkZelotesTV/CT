export const ChatChannelView = ({ channelName }: { channelName: string }) => {
  return (
    <div className="flex-1 flex flex-col bg-dark-100 relative">
      <div className="h-12 border-b border-dark-400 flex items-center px-4 shadow-sm bg-dark-100">
        <span className="text-gray-400 text-2xl mr-2">#</span>
        <span className="font-bold text-white">{channelName}</span>
      </div>
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Dies ist der Anfang des Kanals #{channelName}.
      </div>
    </div>
  );
};