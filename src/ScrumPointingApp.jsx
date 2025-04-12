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

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
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
      const randomY = Math.random() * 40 + 20;
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
      setSessionStartTime(Date.now());
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
      )}

      {/* Emoji Buttons */}
      {hasJoined && (
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
      )}

      {/* Timer */}
      {hasJoined && sessionActive && (
        <div className="text-sm text-center mb-3 text-blue-700 font-medium">
          ⏱️ Session Time: {formatTime(elapsedSeconds)}
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
            </div>
          )}
        </div>

        {/* Main content (chat, voting, queue, etc.) */}
        {/* You already have this full block from previous version, just paste it in here below this line */}
      </div>
    </div>
  );
}

