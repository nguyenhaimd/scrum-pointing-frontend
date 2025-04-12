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
const AVATAR_EMOJIS = [
  '🐶','🦅','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
  '🦁','🐮','🐷','🐸','🐵','🦄','🐙','🐳','🐢','🐤', '🚀',
  '🐝','🦋','🦀','🦓','🦒','🦘','🦥','🦦','🦨','🦡', '🛵',
  '🦧','🦬','🐫','🐪','🐘','🐊','🦍','🐎','🐖','🐏', '🗽',
  '🐑','🐐','🦌','🐓','🦃','🕊️','🐇','🐿️','🦝','🦛', '🗼'
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
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [reactions, setReactions] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [emojiSummary, setEmojiSummary] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [error, setError] = useState('');
  const [width, height] = useWindowSize();
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
    socket.on('participantsUpdate', ({ names, roles, avatars }) => {
      setParticipants(names);
      setParticipantRoles(roles || {});
      setParticipantAvatars(avatars || {});
    });

    socket.on('userJoined', (user) => toast.success(`🔵 ${user} joined the room.`));
    socket.on('userLeft', (user) => toast(`🔴 ${user} left the room.`, { icon: '👋' }));

    socket.on('updateVotes', (updatedVotes) => setVotes(updatedVotes));
    socket.on('emojiReaction', ({ sender, emoji }) => {
      const id = Date.now();
      setReactions(prev => [...prev, { sender, emoji, id }]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 4000);
    });
    socket.on('emojiSummary', (summary) => setEmojiSummary(summary));

    socket.on('startSession', (title) => {
      setStoryTitle(title);
      setSessionActive(true);
      setVotes({});
      setVote(null);
      setVotesRevealed(false);
    });

    socket.on('revealVotes', () => {
      setVotesRevealed(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 10000);
    });

    socket.on('sessionEnded', () => {
      setSessionActive(false);
      setStoryTitle('');
      setVotes({});
      setVote(null);
      setVotesRevealed(false);
      setShowConfetti(false);
    });

    socket.on('teamChat', ({ sender, text }) => {
      setChatMessages(prev => [...prev, { sender, text }]);
    });

    socket.on('typingUpdate', (users) => {
      setTypingUsers(users.filter((u) => u !== nickname));
    });

    socket.on('connectionStatus', (status) => {
      setConnectionStatus(status);
    });

    return () => {
      socket.off('participantsUpdate');
      socket.off('userJoined');
      socket.off('userLeft');
      socket.off('updateVotes');
      socket.off('startSession');
      socket.off('revealVotes');
      socket.off('sessionEnded');
      socket.off('teamChat');
      socket.off('emojiReaction');
      socket.off('emojiSummary');
      socket.off('typingUpdate');
      socket.off('connectionStatus');
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
    socket.emit('join', { nickname, room, role, avatar: selectedAvatar });
    setHasJoined(true);
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
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 to-blue-200 p-6 font-sans text-gray-800">
      <Toaster position="top-right" reverseOrder={false} />

      {/* Floating emoji reactions */}
      <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50">
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: -80 }}
            exit={{ opacity: 0 }}
            className="text-center"
          >
            <div className="text-4xl">{r.emoji}</div>
            <div className="text-xs text-gray-600">{r.sender}</div>
          </motion.div>
        ))}
      </div>

      <div className="max-w-2xl mx-auto bg-white shadow-xl rounded-2xl p-6 relative">
        {/* Connection status */}
        <div className="absolute top-2 right-2 text-xs">
          <span className={`inline-block w-3 h-3 rounded-full mr-1 ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'reconnecting' ? 'bg-yellow-400' : 'bg-red-500'}`}></span>
          {connectionStatus}
        </div>

        {hasJoined && (
          <div className="mb-4 text-sm text-center text-blue-700 font-semibold">
            {selectedAvatar} Logged in as {nickname} ({role})
          </div>
        )}

        {!hasJoined ? (
          <div className="text-center">
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
            {/* Emoji bar */}
            <div className="flex gap-2 justify-center my-4 flex-wrap">
              {REACTION_EMOJIS.map((emoji, index) => (
                <button key={index} className="text-2xl hover:scale-110 transition" onClick={() => sendReaction(emoji)}>{emoji}</button>
              ))}
            </div>

            {/* User list */}
            <div className="mb-4 bg-white border rounded p-3 shadow text-sm">
              <h3 className="font-semibold mb-2">Users in this session:</h3>
              <div className="grid grid-cols-2 gap-2">
                {participants.map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <span className="text-3xl">{participantAvatars[p] || '❓'}</span>
                    <span>{p} ({participantRoles[p]})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat */}
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
                <input className="flex-1 border p-1 rounded" placeholder="Type a message..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => {
                  if (e.key === 'Enter') sendChatMessage();
                  else handleTyping();
                }} />
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
                      {participants.filter(p => participantRoles[p] === 'Developer').map((p) => (
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
                      <button key={pt} className="bg-white border border-blue-300 text-blue-600 font-bold text-xl rounded-xl shadow hover:bg-blue-50 py-4 transition" onClick={() => castVote(pt)}>{pt}</button>
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
                            <li key={user}><strong>{participantAvatars[user] || '❓'} {user}</strong>: {pt}</li>
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
                    {Object.keys(emojiSummary).length > 0 && (
                      <div className="mt-4 text-center text-sm">
                        <h4 className="font-semibold mb-2">Emoji Leaderboard</h4>
                        <ul className="inline-block text-left">
                          {Object.entries(emojiSummary)
                            .sort((a, b) => b[1] - a[1])
                            .map(([emoji, count]) => (
                              <li key={emoji}>{emoji} — {count}</li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {isScrumMaster && (
                  <div className="flex justify-center flex-wrap gap-4 mt-6">
                    {!votesRevealed && (
                      <button className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700" onClick={revealVotes}>Reveal Votes</button>
                    )}
                    {votesRevealed && (
                      <button className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600" onClick={initiateRevote}>Revote</button>
                    )}
                    <button className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700" onClick={endSession}>Next Story/Defect</button>
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
  );
}