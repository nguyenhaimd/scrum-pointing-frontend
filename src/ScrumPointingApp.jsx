import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Confetti from 'react-confetti';
import { useWindowSize } from '@react-hook/window-size';
import { motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';

const socket = io(import.meta.env.VITE_BACKEND_URL, {
  transports: ['websocket'],
  secure: true,
  reconnectionAttempts: 5,
});

const POINT_OPTIONS = [1, 2, 3, 5, 8, 13];
const ROLE_OPTIONS = ['Developer', 'Observer', 'Scrum Master'];
const MOOD_OPTIONS = {
  '😎': 'Ready',
  '🧠': 'Focused',
  '💤': 'Tired',
  '🐢': 'Still thinking',
  '🚀': 'Let’s go',
  '☕': 'Coffee'
};
const AVATAR_EMOJIS = [
  '🦅','🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
  '🦁','🐮','🐷','🐸','🐵','🦄','🐙','🐳','🐢','🐤',
  '🐝','🦋','🦀','🦓','🦒','🦘','🦥','🦦','🦨','🦡',
  '🦧','🦬','🐫','🐪','🐘','🐊','🦍','🐎','🐖','🐏',
  '🐑','🐐','🦌','🐓','🦃','🕊️','🐇','🐿️','🦝','🦛'
];
const REACTION_EMOJIS = ['👍','👎','🤔','🎉','❤️','😂','😢','👏','😮','💯','🔥','😍'];

export default function ScrumPointingApp() {
  const [nickname, setNickname] = useState('');
  const [room, setRoom] = useState('AFOSR Pega Developers');
  const [role, setRole] = useState('Developer');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)]);
  const [hasJoined, setHasJoined] = useState(false);
  const [storyTitle, setStoryTitle] = useState('');
  const [storyQueue, setStoryQueue] = useState([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [vote, setVote] = useState(null);
  const [votes, setVotes] = useState({});
  const [votesRevealed, setVotesRevealed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [participantRoles, setParticipantRoles] = useState({});
  const [participantAvatars, setParticipantAvatars] = useState({});
  const [participantMoods, setParticipantMoods] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [reactions, setReactions] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [error, setError] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [myMood, setMyMood] = useState('😎');
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [globalStartTime, setGlobalStartTime] = useState(null);
  const [globalElapsedSeconds, setGlobalElapsedSeconds] = useState(0);
  const [width, height] = useWindowSize();
  const [voteHistory, setVoteHistory] = useState([]);
  const [voteStartTime, setVoteStartTime] = useState(null);
  const chatRef = useRef(null);

  const isScrumMaster = role === 'Scrum Master';
  const isDeveloper = role === 'Developer';
  const isObserver = role === 'Observer';

  const totalDevelopers = participants.filter(p => participantRoles[p] === 'Developer').length;
  const votesCast = participants.filter(p => participantRoles[p] === 'Developer' && votes[p] !== null).length;

  const getConsensus = () => {
    const values = Object.entries(votes)
      .filter(([u]) => participantRoles[u] === 'Developer')
      .map(([_, v]) => Number(v));
    if (!values.length) return [];
    const freq = values.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
    const maxFreq = Math.max(...Object.values(freq));
    return Object.entries(freq)
      .filter(([_, f]) => f === maxFreq)
      .map(([v]) => Number(v))
      .sort((a, b) => a - b);
  };

  const consensusPoints = votesRevealed ? getConsensus() : [];
  useEffect(() => {
    let timer;
    if (sessionStartTime) {
      timer = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - sessionStartTime) / 1000));
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [sessionStartTime]);

  useEffect(() => {
    let timer;
    if (globalStartTime) {
      timer = setInterval(() => {
        setGlobalElapsedSeconds(Math.floor((Date.now() - globalStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [globalStartTime]);

  useEffect(() => {
    socket.on('participantsUpdate', ({ names, roles, avatars, moods }) => {
      setParticipants(names);
      setParticipantRoles(roles || {});
      setParticipantAvatars(avatars || {});
      setParticipantMoods(moods || {});
    });

    socket.on('userJoined', (user) => toast.success(`🔵 ${user} joined the room.`));
    socket.on('userLeft', (user) => toast(`🔴 ${user} left the room.`, { icon: '👋' }));
    socket.on('updateVotes', (updatedVotes) => setVotes(updatedVotes));
    socket.on('typingUpdate', (users) => setTypingUsers(users.filter((u) => u !== nickname)));
    socket.on('connectionStatus', (status) => setConnectionStatus(status));

    socket.on('emojiReaction', ({ sender, emoji }) => {
      const id = Date.now();
      const randomX = Math.random() * 80 + 10;
      const randomY = Math.random() * 60 + 10;
      const randomScale = Math.random() * 0.5 + 1;
      setReactions((prev) => [
        ...prev,
        { id, sender, emoji, x: randomX, y: randomY, scale: randomScale }
      ]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 4000);
    });

    socket.on('startSession', (title) => {
      setStoryTitle(title);
      setSessionActive(true);
      setVotes({});
      setVote(null);
      setVotesRevealed(false);
      setVoteStartTime(Date.now());
      setSessionStartTime(Date.now());
    });

    socket.on('revealVotes', () => {
      setVotesRevealed(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 10000);
      const consensus = getConsensus();
const voteDuration = voteStartTime ? Math.floor((Date.now() - voteStartTime) / 1000) : 0;

setVoteHistory((prev) => {
  const newHistory = [...prev, {
    story: storyTitle,
    consensus,
    duration: voteDuration
  }];
  return newHistory.slice(-5); // keep only last 5
});
    });

    socket.on('sessionEnded', () => {
      setSessionActive(false);
      setStoryTitle('');
      setVotes({});
      setVote(null);
      setVotesRevealed(false);
      setShowConfetti(false);
      setSessionStartTime(null);
    });

    socket.on('teamChat', ({ sender, text }) => {
      setChatMessages(prev => [...prev, { sender, text }]);
    });

    return () => {
      socket.off('participantsUpdate');
      socket.off('userJoined');
      socket.off('userLeft');
      socket.off('updateVotes');
      socket.off('typingUpdate');
      socket.off('connectionStatus');
      socket.off('emojiReaction');
      socket.off('startSession');
      socket.off('revealVotes');
      socket.off('sessionEnded');
      socket.off('teamChat');
    };
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const sendChatMessage = () => {
    if (chatInput.trim()) {
      socket.emit('teamChat', { room, sender: nickname, text: chatInput });
      setChatInput('');
    }
  };

  const sendReaction = (emoji) => {
    socket.emit('emojiReaction', { sender: nickname, emoji });
  };

  const handleTyping = () => {
    socket.emit('userTyping');
  };

  const updateMood = (emoji) => {
    setMyMood(emoji);
    socket.emit('updateMood', { nickname, emoji });
  };

  const join = () => {
    setError('');
    if (!nickname.trim() || !room.trim()) {
      setError('Team Name and Nickname are required.');
      return;
    }
    if (role === 'Scrum Master') {
      const existingSMs = participants.filter(p => participantRoles[p] === 'Scrum Master');
      if (existingSMs.length > 0) {
        setError('There is already a Scrum Master in this room.');
        return;
      }
    }
    socket.emit('join', { nickname, room, role, avatar: selectedAvatar, emoji: myMood });
    setHasJoined(true);
    setGlobalStartTime(Date.now());
  };

  const castVote = (point) => {
    setVote(point);
    socket.emit('vote', { nickname, point });
  };

  const revealVotes = () => socket.emit('revealVotes');
  const endSession = () => socket.emit('endSession');

  const startSession = (title, index) => {
    socket.emit('startSession', { title, room });
    setStoryQueue(storyQueue.filter((_, i) => i !== index));
  };

  const addStoryToQueue = () => {
    if (storyTitle.trim()) {
      setStoryQueue([...storyQueue, storyTitle]);
      setStoryTitle('');
    }
  };

  const initiateRevote = () => {
    socket.emit('startSession', { title: storyTitle, room });
    setVotes({});
    setVote(null);
    setVotesRevealed(false);
    setSessionStartTime(Date.now());
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 to-blue-200 p-4 font-sans text-gray-800">
      <Toaster position="top-right" reverseOrder={false} />

      {/* Floating Emoji Reactions */}
      <div className="fixed inset-0 z-50 pointer-events-none">
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: 1,
              x: `${r.x}%`,
              y: `-${r.y}vh`,
              scale: r.scale,
              transition: { duration: 1.5, ease: 'easeOut' }
            }}
            exit={{ opacity: 0 }}
            className="absolute text-center"
            style={{ left: `${r.x}%`, top: `${r.y}%` }}
          >
            <div className="text-4xl">{r.emoji}</div>
            <div className="text-xs text-gray-600">{r.sender}</div>
          </motion.div>
        ))}
      </div>

      {/* Mood Toggle */}
      {hasJoined && (
  <>
    <div className="text-sm text-center font-medium mb-1 text-gray-700">
      Select Your Current Mood:
    </div>
    <div className="flex justify-center gap-2 mb-2 flex-wrap">
      {Object.entries(MOOD_OPTIONS).map(([emoji, label]) => (
        <button
          key={emoji}
          onClick={() => updateMood(emoji)}
          className={`text-2xl px-2 py-1 rounded-full ${myMood === emoji ? 'bg-blue-100 border border-blue-500' : 'hover:bg-gray-100'}`}
          title={label}
        >
          {emoji}
        </button>
      ))}
    </div>
  </>
)}

      {/* Emoji Buttons */}
      {hasJoined && (
  <>
    <div className="text-sm text-center font-medium mt-4 mb-1 text-gray-700">
      Send a Quick Emoji Reaction:
    </div>
    <div className="flex flex-wrap justify-center gap-3 my-2">
      {REACTION_EMOJIS.map((emoji, index) => (
        <button
          key={index}
          className="text-2xl hover:scale-125 transition"
          onClick={() => sendReaction(emoji)}
          title={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  </>
)}

      {/* Timer */}
      {hasJoined && sessionActive && (
        <div className="text-sm text-center mb-3 text-blue-700 font-medium">
          ⏱️ Current Story Time: {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Sidebar */}
        <div className={`lg:w-1/4 w-full ${hasJoined ? '' : 'hidden'}`}>
          <div className="flex lg:hidden justify-between items-center mb-2">
            <span className="font-semibold">Users in this session</span>
            <button
              className="text-sm text-blue-600 underline"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              {showSidebar ? 'Hide' : 'Show'}
            </button>
          </div>

          {(showSidebar || width >= 1024) && (
            <div className="bg-white border rounded p-3 shadow text-sm">
              <h3 className="font-semibold mb-2 hidden lg:block">Users in this session</h3>
              <div className="mb-3 text-sm text-center text-blue-700 font-medium">
  ⏱️ Elapsed Time: {Math.floor(globalElapsedSeconds / 60)}:{(globalElapsedSeconds % 60).toString().padStart(2, '0')}
</div>
              <div className="grid grid-cols-1 gap-2">
                {participants.map((p) => (
                  <div key={p} className="flex items-center gap-2 border-b pb-1">
                    <span className="text-2xl">{participantAvatars[p] || '❓'}</span>
                    <div className="flex-1">
                      <div className="font-medium">{p} ({participantRoles[p]})</div>
                      {participantMoods[p] && (
                        <div className="text-sm text-gray-500">Mood: {participantMoods[p]}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Vote History Section */}
<div className="mt-6 border-t pt-3">
  <h3 className="font-semibold mb-2">📘 Vote History</h3>
  {voteHistory.length === 0 && (
    <p className="text-gray-500 text-sm">No votes yet</p>
  )}
  <ul className="space-y-2">
    {voteHistory.slice(-5).reverse().map((item, i) => (
      <li key={i} className="border-b pb-2 text-sm">
        <div><strong>📝 {item.story}</strong></div>
        <div>📊 Consensus: <span className="font-medium">{item.consensus.join(', ')}</span></div>
        <div>⏱️ Time: {item.duration}s</div>
      </li>
    ))}
  </ul>
</div>
            </div>
          )}
        </div>

        {/* Main Area */}
        <div className="flex-1">
          {!hasJoined ? (
            <div className="max-w-md mx-auto text-center">
              <h1 className="text-2xl font-bold mb-4 text-blue-700">Join the Pointing Session</h1>
              {error && <p className="text-red-500 mb-2">{error}</p>}
              <input className="p-2 border rounded w-full mb-2" placeholder="Team Name" value={room} onChange={(e) => setRoom(e.target.value)} />
              <input className="p-2 border rounded w-full mb-2" placeholder="Nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
              <select className="p-2 border rounded w-full mb-2" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select className="p-2 border rounded w-full mb-2 text-2xl" value={selectedAvatar} onChange={(e) => setSelectedAvatar(e.target.value)}>
                {AVATAR_EMOJIS.map((emoji) => <option key={emoji} value={emoji}>{emoji}</option>)}
              </select>
              <div className="text-4xl mt-2 text-center">Selected Avatar: {selectedAvatar}</div>
              <button className="bg-blue-600 text-white px-6 py-2 mt-4 rounded hover:bg-blue-700 transition" onClick={join}>Join</button>
            </div>
          ) : (
            <>
              {/* Chat Section */}
              <div className="text-left text-sm mb-4">
                <h3 className="font-semibold mb-1">Team Chat</h3>
                <div ref={chatRef} className="h-32 overflow-y-auto bg-gray-50 border rounded p-2">
                  {chatMessages.map((msg, i) => (
                    <div key={i}><strong>{msg.sender}:</strong> {msg.text}</div>
                  ))}
                </div>
                {typingUsers.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1 italic">{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</p>
                )}
                <div className="mt-2 flex gap-2">
                  <input
                    className="flex-1 border p-1 rounded"
                    placeholder="Type a message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') sendChatMessage();
                      else handleTyping();
                    }}
                  />
                  <button className="px-3 bg-blue-500 text-white rounded" onClick={sendChatMessage}>Send</button>
                </div>
              </div>

              {sessionActive && (
                <>
                  <h2 className="text-xl font-bold mb-4 text-blue-800">Voting for: {storyTitle}</h2>

                  {(isScrumMaster || isObserver) && (
                    <div className="mt-4 text-sm text-gray-600 bg-gray-100 p-3 rounded">
                      <p className="font-semibold mb-2">Voting Progress:</p>
                      <progress className="w-full h-3 mb-2" value={votesCast} max={totalDevelopers}></progress>
                      <ul className="text-sm">
                        {participants
                          .filter(p => participantRoles[p] === 'Developer')
                          .map((p) => (
                            <li key={p}>
                              {participantAvatars[p] || '❓'} {p} — {votes[p] ? '✅ Voted' : '⏳ Waiting'}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {isObserver && (
                    <div className="bg-yellow-50 border border-yellow-300 p-3 rounded mt-4 text-sm">
                      👀 You are observing this session. You can't vote but can watch everything.
                    </div>
                  )}

                  {isDeveloper && !vote && (
                    <div className="grid grid-cols-3 gap-4 mb-4 mt-6">
                      {POINT_OPTIONS.map((pt) => (
                        <button
                          key={pt}
                          className="bg-white border border-blue-300 text-blue-600 font-bold text-xl rounded-xl shadow hover:bg-blue-50 py-4 transition"
                          onClick={() => castVote(pt)}
                        >
                          {pt}
                        </button>
                      ))}
                    </div>
                  )}

                  {vote && <p className="text-green-600 text-lg font-semibold mb-4">You voted: {vote}</p>}

                  {votesRevealed && (
                    <>
                      {showConfetti && <Confetti width={width} height={height} />}
                      <div className="mt-6 bg-gray-50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold mb-2">Votes</h3>
                        <ul className="text-left inline-block">
                          {Object.entries(votes)
                            .filter(([user]) => participantRoles[user] === 'Developer')
                            .map(([user, pt]) => (
                              <li key={user}>
                                <strong>{participantAvatars[user] || '❓'} {user}</strong>: {pt}
                              </li>
                            ))}
                        </ul>
                      </div>
                      {consensusPoints.length > 0 && (
                        <motion.p
                          className="text-lg text-center mt-4 text-green-700 font-bold"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.6 }}
                        >
                          📊 Consensus: {consensusPoints.join(', ')} point{consensusPoints.length > 1 ? 's' : ''}
                        </motion.p>
                      )}
                    </>
                  )}

                  {isScrumMaster && (
                    <div className="flex justify-center flex-wrap gap-4 mt-6">
                      {!votesRevealed && (
                        <button className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700" onClick={revealVotes}>
                          Reveal Votes
                        </button>
                      )}
                      {votesRevealed && (
                        <button className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600" onClick={initiateRevote}>
                          Revote
                        </button>
                      )}
                      <button className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700" onClick={endSession}>
                        Next Story/Defect
                      </button>
                    </div>
                  )}
                </>
              )}

              {!sessionActive && isScrumMaster && (
                <div className="mb-6">
                  <input className="p-2 border rounded w-full mb-2" placeholder="Add story title" value={storyTitle} onChange={(e) => setStoryTitle(e.target.value)} />
                  <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" onClick={addStoryToQueue}>Add Story</button>
                  {storyQueue.length > 0 && (
                    <div className="mt-4">
                      <h3 className="font-semibold mb-2">Queued Stories:</h3>
                      {storyQueue.map((title, index) => (
                        <button key={index} className="bg-gray-100 hover:bg-gray-200 border w-full text-left px-4 py-2 mb-1 rounded" onClick={() => startSession(title, index)}>▶️ {title}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!sessionActive && !isScrumMaster && (
                <p className="text-gray-500 mt-4">Waiting for Scrum Master to start the session...</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

