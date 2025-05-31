import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Confetti from 'react-confetti';
import { useWindowSize } from '@react-hook/window-size';
import { motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';

//
// ─── DEVICE DETECTION FUNCTION ───────────────────────────────────────────────
//
function getDeviceType() {
  const ua = navigator.userAgent;
  return /Mobi|Android|iPhone|iPad|iPod/.test(ua) ? 'mobile' : 'desktop';
}

//
// ─── SOCKET.IO SETUP ───────────────────────────────────────────────────────────
//
const socket = io(import.meta.env.VITE_BACKEND_URL, {
  transports: ['websocket'],
  secure: true,
  reconnectionAttempts: 5,
});

const POINT_OPTIONS = [1, 2, 3, 5, 8, 13];
const ROLE_OPTIONS = ['Developer', 'Observer', 'Product Owner', 'Scrum Master'];
const MOOD_OPTIONS = {
  '😎': 'Ready',
  '🧠': 'Focused',
  '💤': 'Tired',
  '🐢': 'Still thinking',
  '🚀': 'Let’s go',
  '☕': 'Coffee',
};
const AVATAR_EMOJIS = [
  '🦅','🏋','🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
  '🦁','🐮','🐷','🐸','🐵','🦄','🐙','🐳','🐢','🐤',
  '🐝','🦋','🦀','🦓','🦒','🦘','🦥','🦦','🦨','🦡',
  '🦧','🦬','🐫','🐪','🐘','🐊','🦍','🐎','🐖','🐏',
  '🐑','🐐','🦌','🐓','🦃','🕊️','🐇','🐿️','🦝','🦛',
];
const REACTION_EMOJIS = ['👍','👎','🤔','🎉','❤️','😂','😢','👏','😮','💯','🔥','😍'];

export default function ScrumPointingApp() {
  // ─── STATE HOOKS ─────────────────────────────────────────────────────────────
  const [nickname, setNickname] = useState('');
  const [room, setRoom] = useState('AFOSR Pega Developers');
  const [role, setRole] = useState('Developer');
  const [selectedAvatar, setSelectedAvatar] = useState(
    AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)]
  );
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
  const [participantConnections, setParticipantConnections] = useState({});
  const [devices, setDevices] = useState({}); // mobile/desktop map
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
  const [voteStartTime, setVoteStartTime] = useState(null);
  const [currentUserInfo, setCurrentUserInfo] = useState({});
  const [showAbout, setShowAbout] = useState(false);

  // Offline section state
  const [showOffline, setShowOffline] = useState(false);

  // Offline-vs-online arrays (computed each render)
  const onlineParticipants = participants.filter((p) => participantConnections[p]);
  const offlineParticipants = participants.filter((p) => !participantConnections[p]);

  // Additional state from original
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [offlineList, setOfflineList] = useState([]);
  const [pendingStart, setPendingStart] = useState(null);
  const [myVoteHistory, setMyVoteHistory] = useState([]);
  const [showReconnectModal, setShowReconnectModal] = useState(false);

  const [width, height] = useWindowSize();
  const chatRef = useRef(null);
  const isScrumMaster = role === 'Scrum Master';
  const isDeveloper = role === 'Developer';
  const isObserver = role === 'Observer' || role === 'Product Owner';

  // ─── TIMERS & CONSENSUS ────────────────────────────────────────────────────────
  const totalDevelopers = participants.filter((p) => participantRoles[p] === 'Developer').length;
  const votesCast = participants.filter(
    (p) => participantRoles[p] === 'Developer' && votes[p] !== null
  ).length;

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

  // ─── EFFECTS ───────────────────────────────────────────────────────────────────
  // Timer for sessionStartTime
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

  // Timer for globalStartTime
  useEffect(() => {
    let timer;
    if (globalStartTime) {
      timer = setInterval(() => {
        setGlobalElapsedSeconds(Math.floor((Date.now() - globalStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [globalStartTime]);

  // ─── SOCKET.EVENT LISTENERS ────────────────────────────────────────────────────
  useEffect(() => {
    socket.on('updateStoryQueue', (queue) => {
      setStoryQueue(queue);
    });

    socket.on(
      'participantsUpdate',
      ({ names, roles, avatars, moods, connected, devices }) => {
        setParticipants(names);
        setParticipantRoles(roles || {});
        setParticipantAvatars(avatars || {});
        setParticipantMoods(moods || {});

        // Online/offline map
        const connectionMap = names.reduce((acc, name) => {
          acc[name] = connected?.includes(name);
          return acc;
        }, {});
        setParticipantConnections(connectionMap);

        // Save devices map
        setDevices(devices || {});
      }
    );

    socket.on('userJoined', (user) => {
      toast.success(`🔵 ${user} joined the room.`);
    });

    socket.on('userLeft', (user) => {
      toast(`🔴 ${user} left the room.`, { icon: '👋' });
      setChatMessages((prev) => [
        ...prev,
        { sender: 'System', text: `${user} disconnected.` },
      ]);
    });

    socket.on('updateVotes', (updatedVotes) => setVotes(updatedVotes));
    socket.on('typingUpdate', (users) =>
      setTypingUsers(users.filter((u) => u !== nickname))
    );
    socket.on('emojiReaction', ({ sender, emoji }) => {
      const id = Date.now();
      const randomX = Math.random() * 80 + 10;
      const randomY = Math.random() * 60 + 10;
      const randomScale = Math.random() * 0.5 + 1;
      setReactions((prev) => [
        ...prev,
        { id, sender, emoji, x: randomX, y: randomY, scale: randomScale },
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

    socket.on('sessionTerminated', () => {
      setHasJoined(false);
      setSessionActive(false);
      setStoryTitle('');
      setStoryQueue([]);
      setVotes({});
      setVote(null);
      setVotesRevealed(false);
      setChatMessages([]);
      toast(`🔴 Pointing session ended by Scrum Master.`, { icon: '⚠️' });
    });

    socket.on('teamChat', (msg) => {
      setChatMessages((prev) => {
        if (msg.type === 'voteSummary') {
          const collapsed = prev.map((m) => {
            if (m.type === 'voteSummary') {
              return { ...m, summary: { ...m.summary, expand: false } };
            }
            return m;
          });
          return [...collapsed, msg];
        } else {
          return [...prev, msg];
        }
      });
    });

    socket.on('connect', () => {
      setConnectionStatus('connected');
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      setShowReconnectModal(true);
    });

    return () => {
      socket.off('updateStoryQueue');
      socket.off('participantsUpdate');
      socket.off('userJoined');
      socket.off('userLeft');
      socket.off('updateVotes');
      socket.off('typingUpdate');
      socket.off('emojiReaction');
      socket.off('startSession');
      socket.off('revealVotes');
      socket.off('sessionEnded');
      socket.off('sessionTerminated');
      socket.off('teamChat');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  // ─── SCROLL CHAT ON NEW MESSAGES ─────────────────────────────────────────────────
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // ─── CHECK CONNECTION EVERY 10S ─────────────────────────────────────────────────
  useEffect(() => {
    const checkConnection = () => {
      if (socket.disconnected) {
        setConnectionStatus('disconnected');
        setShowReconnectModal(true);
      }
    };
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  // ─── TYPING & CHAT HANDLERS ─────────────────────────────────────────────────────
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

  // ─── JOIN / VOTE / SESSION HANDLERS ──────────────────────────────────────────────
  const join = () => {
    setError('');
    if (!nickname.trim() || !room.trim()) {
      setError('Team Name and Nickname are required.');
      return;
    }
    if (role === 'Scrum Master') {
      const existingSMs = participants.filter((p) => participantRoles[p] === 'Scrum Master');
      if (existingSMs.length > 0) {
        setError('There is already a Scrum Master in this room.');
        return;
      }
    }
    const joinData = {
      nickname,
      room,
      role,
      avatar: selectedAvatar,
      emoji: myMood,
      device: getDeviceType(),
    };
    console.log('📱 Device Type Detected:', joinData.device);
    socket.emit('join', joinData);
    setHasJoined(true);
    setGlobalStartTime(Date.now());
    setCurrentUserInfo({ nickname, avatar: selectedAvatar, role });
  };

  const castVote = (point) => {
    setVote(point);
    socket.emit('vote', { nickname, point });
    setMyVoteHistory((prev) => {
      const story = storyTitle || 'Untitled Story';
      const filtered = prev.filter((item) => item.story !== story);
      return [...filtered, { story, point }];
    });
  };

  const revealVotes = () => {
    socket.emit('revealVotes');
    const consensus = getConsensus();
    const voteSummary = {
      story: storyTitle || 'Untitled Story',
      votes: participants
        .filter((p) => participantRoles[p] === 'Developer')
        .map((p) => ({
          name: p,
          avatar: participantAvatars[p] || '❓',
          point: votes[p] !== null ? votes[p] : '—',
        })),
      consensus,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      expand: true,
    };
    setChatMessages((prev) => {
      const updated = prev.map((m) => {
        if (m.type === 'voteSummary') {
          return { ...m, summary: { ...m.summary, expand: false } };
        }
        return m;
      });
      return [...updated, { sender: 'System', type: 'voteSummary', summary: voteSummary }];
    });
    socket.emit('teamChat', {
      sender: 'System',
      type: 'voteSummary',
      summary: voteSummary,
    });
  };

  const endSession = () => socket.emit('endSession');

  const startSession = (title, index) => {
    socket.emit('startSession', { title, room });
    setStoryQueue(storyQueue.filter((_, i) => i !== index));
  };

  const initiateRevote = () => {
    socket.emit('startSession', { title: storyTitle, room });
    setVotes({});
    setVote(null);
    setVotesRevealed(false);
    setSessionStartTime(Date.now());
  };

  const handleStartSession = (title, index) => {
    const offline = participants
      .filter((p) => participantRoles[p] === 'Developer')
      .filter((p) => !participantConnections[p]);
    if (offline.length) {
      setOfflineList(offline);
      setPendingStart({ title, index });
      setShowOfflineModal(true);
    } else {
      startSession(title, index);
    }
  };

  const confirmStartAnyway = () => {
    setShowOfflineModal(false);
    if (pendingStart) {
      startSession(pendingStart.title, pendingStart.index);
      setPendingStart(null);
    }
  };

  const cancelStart = () => {
    setShowOfflineModal(false);
    setPendingStart(null);
  };

  // ─── TIME FORMAT ───────────────────────────────────────────────────────────────
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ─── RETURN JSX ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 to-blue-200 p-4 font-sans text-gray-800 relative">
      <Toaster position="top-right" reverseOrder={false} />

      {/* ─── Offline Modal ───────────────────────────────────────────────── */}
      {showOfflineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-11/12 max-w-md space-y-4">
            <h3 className="text-xl font-bold text-red-600">⚠️ Some developers are offline</h3>
            <p className="text-sm text-gray-700">
              The following {offlineList.length > 1 ? 'developers are' : 'developer is'} disconnected:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-800 mb-4">
              {offlineList.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelStart}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmStartAnyway}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Start Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reconnect Modal ─────────────────────────────────────────────────── */}
      {hasJoined && showReconnectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 w-11/12 max-w-sm text-center">
            <h2 className="text-lg font-semibold mb-3">You’ve been disconnected</h2>
            <p className="text-sm text-gray-600 mb-4">
              Tap below to rejoin the session once internet is restored.
            </p>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              onClick={() => {
                const rejoinData = {
                  nickname,
                  room,
                  role,
                  avatar: selectedAvatar,
                  emoji: myMood,
                  device: getDeviceType(),
                };
                console.log('📱 Device Type Detected (Rejoin):', rejoinData.device);
                socket.emit('join', rejoinData);
                setShowReconnectModal(false);
                toast.success('🔄 Attempting to reconnect...');
              }}
            >
              Rejoin Now
            </button>
          </div>
        </div>
      )}

      {/* ─── Offline Banner (Sticky) ───────────────────────────────────────────── */}
      {hasJoined && connectionStatus === 'disconnected' && (
        <div className="bg-red-600 text-white py-2 text-center font-semibold sticky top-0 z-50">
          ⚠️ You’re offline. Trying to reconnect...
        </div>
      )}

      {/* ─── Floating Emoji Reactions ────────────────────────────────────────────── */}
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
              transition: { duration: 1.5, ease: 'easeOut' },
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

      {/* ─── Header (User Info + Controls) ─────────────────────────────────────── */}
      {hasJoined && (
        <div className="w-full md:w-auto md:absolute md:top-2 md:right-4 z-30 bg-white px-4 py-2 rounded shadow text-sm flex items-center justify-between space-x-4">
          {/* User Info */}
          <div className="flex items-center space-x-2">
            <div className="text-xs text-gray-500">You are logged in as:</div>
            <div className="text-md flex items-center space-x-1">
              <span className="text-2xl">{currentUserInfo.avatar}</span>
              <span className="font-bold">{currentUserInfo.nickname}</span>
              <span className="text-gray-600">({currentUserInfo.role})</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Only Scrum Master: End Pointing Session */}
            {isScrumMaster && (
              <button
                className="bg-red-800 text-white px-3 py-1 rounded hover:bg-red-900 text-xs whitespace-nowrap"
                onClick={() => socket.emit('endPointingSession')}
              >
                End Pointing Session
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Mood & Reactions ────────────────────────────────────────────────────── */}
      {hasJoined && (
        <>
          <div className="text-sm text-center font-medium mb-1 text-gray-700 mt-2">
            Select Your Current Mood:
          </div>
          <div className="flex justify-center gap-2 mb-2 flex-wrap">
            {Object.entries(MOOD_OPTIONS).map(([emoji, label]) => (
              <button
                key={emoji}
                onClick={() => updateMood(emoji)}
                className={`text-2xl px-2 py-1 rounded-full ${
                  myMood === emoji ? 'bg-blue-100 border border-blue-500' : 'hover:bg-gray-100'
                }`}
                title={label}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}

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

      {/* ─── Timer ───────────────────────────────────────────────────────────────── */}
      {hasJoined && sessionActive && (
        <div className="text-sm text-center mb-3 text-blue-700 font-medium">
          ⏱️ Current Story Time: {formatTime(elapsedSeconds)}
        </div>
      )}

      {/* ─── MAIN LAYOUT ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* ─── Sidebar (Participants) ───────────────────────────────────────── */}
        <div className={`lg:w-1/4 w-full ${hasJoined ? '' : 'hidden'}`}>
          {(showSidebar || width >= 1024) && (
            <div className="bg-white border rounded p-3 shadow text-sm flex flex-col h-[calc(100vh-4rem)]">
              {/* Sticky Header */}
              <div className="sticky top-0 bg-white z-10 pb-2 pt-1">
                <div className="text-xs font-semibold text-gray-700 border-b pb-1">
                  👥 Users Online: {onlineParticipants.length} / {participants.length}
                </div>
                <div className="mb-3 text-sm text-center text-blue-700 font-medium">
                  ⏱️ Elapsed Time: {formatTime(globalElapsedSeconds)}
                </div>
              </div>

              {/* Online Participants (2-column grid on lg) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 flex-1 overflow-y-auto pr-2 custom-scrollbar py-1">
                {onlineParticipants.map((p) => {
                  const role = participantRoles[p];
                  const mood = participantMoods[p];
                  const deviceType = devices[p];
                  return (
                    <div
                      key={p}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 shadow-sm
                        ${deviceType === 'mobile' ? 'bg-yellow-50' : 'bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <span className="text-2xl">{participantAvatars[p] || '❓'}</span>
                          {deviceType === 'mobile' && (
                            <div className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full" />
                          )}
                        </div>
                        <div className="text-sm leading-tight">
                          <div className="font-semibold text-gray-800">{p}</div>
                          <div className="text-xs text-gray-500">{role}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end text-xs space-y-1">
                        <div className="text-green-600 font-medium">🟢 Online</div>
                        {mood && <div className="text-gray-500">{mood}</div>}
                        {deviceType === 'mobile' ? (
                          <span className="text-sm">📱</span>
                        ) : (
                          <span className="text-sm">💻</span>
                        )}
                        {isScrumMaster && (
                          <button
                            className="text-red-500 hover:underline text-xs"
                            onClick={() => socket.emit('forceRemoveUser', p)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Collapsible Offline Section */}
              {offlineParticipants.length > 0 && (
                <div className="mt-4">
                  <button
                    className="w-full flex justify-between items-center text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded"
                    onClick={() => setShowOffline(!showOffline)}
                  >
                    <span>🔴 Offline ({offlineParticipants.length})</span>
                    <span>{showOffline ? '▲' : '▼'}</span>
                  </button>

                  {showOffline && (
                    <div className="mt-2 space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                      {offlineParticipants.map((p) => {
                        const role = participantRoles[p];
                        const mood = participantMoods[p];
                        const deviceType = devices[p];
                        return (
                          <div
                            key={p}
                            className={`flex items-center justify-between rounded-lg px-3 py-2 shadow-sm
                              ${deviceType === 'mobile' ? 'bg-yellow-50' : 'bg-gray-50'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <span className="text-2xl">{participantAvatars[p] || '❓'}</span>
                                {deviceType === 'mobile' && (
                                  <div className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full" />
                                )}
                              </div>
                              <div className="text-sm leading-tight">
                                <div className="font-semibold text-gray-800">{p}</div>
                                <div className="text-xs text-gray-500">{role}</div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end text-xs space-y-1">
                              <div className="text-red-500 font-medium">🔴 Offline</div>
                              {mood && <div className="text-gray-500">{mood}</div>}
                              {deviceType === 'mobile' ? (
                                <span className="text-sm">📱</span>
                              ) : (
                                <span className="text-sm">💻</span>
                              )}
                              {isScrumMaster && (
                                <button
                                  className="text-red-500 hover:underline text-xs"
                                  onClick={() => socket.emit('forceRemoveUser', p)}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Main Voting & Chat Area ───────────────────────────────────────── */}
        <div className="flex-1">
          {!hasJoined ? (
            <div className="max-w-md mx-auto text-center">
              <h1 className="text-2xl font-bold mb-4 text-blue-700">Join the Pointing Session</h1>
              {error && <p className="text-red-500 mb-2">{error}</p>}
              <input
                className="p-2 border rounded w-full mb-2"
                placeholder="Team Name"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
              />
              <input
                className="p-2 border rounded w-full mb-2"
                placeholder="Nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <select
                className="p-2 border rounded w-full mb-2"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                className="p-2 border rounded w-full mb-2 text-2xl"
                value={selectedAvatar}
                onChange={(e) => setSelectedAvatar(e.target.value)}
              >
                {AVATAR_EMOJIS.map((emoji) => (
                  <option key={emoji} value={emoji}>
                    {emoji}
                  </option>
                ))}
              </select>
              <div className="text-4xl mt-2 text-center">Selected Avatar: {selectedAvatar}</div>
              <button
                className="bg-blue-600 text-white px-6 py-2 mt-4 rounded hover:bg-blue-700 transition"
                onClick={join}
              >
                Join
              </button>
            </div>
          ) : (
            <>
              {sessionActive && (
                <>
                  <h2 className="text-xl font-bold mb-4 text-blue-800">
                    Voting for: {storyTitle}
                  </h2>

                  {(isScrumMaster || isObserver) && (
                    <div className="mt-4 text-sm text-gray-600 bg-gray-100 p-3 rounded">
                      <p className="font-semibold mb-2">Voting Progress:</p>
                      <progress
                        className="w-full h-3 mb-2"
                        value={votesCast}
                        max={totalDevelopers}
                      />
                      <ul className="text-sm">
                        {participants
                          .filter((p) => participantRoles[p] === 'Developer')
                          .map((p) => (
                            <li key={p}>
                              {participantAvatars[p] || '❓'} {p} —{' '}
                              {votes[p] ? '✅ Voted' : '⏳ Waiting'}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {isObserver && (
                    <div className="bg-yellow-50 border border-yellow-300 p-3 rounded mt-4 text-sm">
                      👀 You are observing this session. You can’t vote but can watch
                      everything.
                    </div>
                  )}

                  {isDeveloper && !votesRevealed && (
                    <>
                      <div className="grid grid-cols-3 gap-4 mb-4 mt-6">
                        {POINT_OPTIONS.map((pt) => (
                          <button
                            key={pt}
                            className={`
                              py-4 px-6 rounded-xl font-bold text-xl shadow transition
                              ${
                                vote === pt
                                  ? 'bg-green-500 text-white border border-green-600'
                                  : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50'
                              }
                            `}
                            onClick={() => castVote(pt)}
                          >
                            {pt}
                          </button>
                        ))}
                      </div>
                      {vote && (
                        <div className="bg-green-50 border border-green-400 text-green-700 rounded p-3 text-sm text-center shadow-sm mt-2">
                          ✅ You can update your vote at any time until the Scrum Master reveals it.
                        </div>
                      )}
                    </>
                  )}

                  {vote && (
                    <p className="text-green-600 text-lg font-semibold mb-4">
                      You voted: {vote}
                    </p>
                  )}

                  {votesRevealed && (
                    <>
                      {showConfetti && <Confetti width={width} height={height} />}
                      <div className="mt-6 bg-gray-50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold mb-2">Votes</h3>
                        <ul className="text-left inline-block">
                          {Object.entries(votes)
                            .filter(
                              ([user, pt]) =>
                                participantRoles[user] === 'Developer' &&
                                pt !== null &&
                                pt !== undefined &&
                                pt !== ''
                            )
                            .map(([user, pt]) => (
                              <li key={user}>
                                <strong>
                                  {participantAvatars[user] || '❓'} {user}
                                </strong>
                                : {pt}
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
                          📊 Consensus: {consensusPoints.join(', ')} point
                          {consensusPoints.length > 1 ? 's' : ''}
                        </motion.p>
                      )}
                    </>
                  )}

                  {isScrumMaster && (
                    <div className="flex justify-center flex-wrap gap-4 mt-6">
                      {!votesRevealed && (
                        <button
                          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                          onClick={revealVotes}
                        >
                          Reveal Votes
                        </button>
                      )}
                      {votesRevealed && (
                        <button
                          className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
                          onClick={initiateRevote}
                        >
                          Revote
                        </button>
                      )}
                      <button
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                        onClick={endSession}
                      >
                        Next Story/Defect
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ─── Chat Section ────────────────────────────────────────────────── */}
              <div className="text-left text-sm mb-4">
                <h3 className="font-semibold mb-1">Team Chat</h3>
                <div
                  ref={chatRef}
                  className="h-32 lg:h-64 overflow-y-auto bg-gray-50 border rounded p-2"
                >
                  {chatMessages.map((msg, i) => {
                    if ((!msg.text && !msg.type) || (!msg.text && msg.sender === 'System'))
                      return null;

                    if (msg.type === 'voteSummary' && isScrumMaster) {
                      const { summary } = msg;
                      return (
                        <div
                          key={i}
                          className="border border-blue-300 rounded p-2 bg-blue-50 text-xs mt-2"
                        >
                          <div className="font-semibold flex justify-between items-center">
                            📝 Summary for "{summary.story}"
                            <button
                              onClick={() => {
                                setChatMessages((prev) =>
                                  prev.map((m, idx) =>
                                    idx === i
                                      ? { ...m, summary: { ...m.summary, expand: !m.summary.expand } }
                                      : { ...m, summary: { ...m.summary, expand: false } }
                                  )
                                );
                              }}
                              className="text-blue-600 underline ml-2 text-xs"
                            >
                              {summary.expand ? 'Hide' : 'Show'}
                            </button>
                          </div>
                          {summary.expand && (
                            <div className="mt-1">
                              <div className="text-green-700 mb-1">
                                📊 Consensus: {summary.consensus.join(', ')}
                              </div>
                              <ul className="list-disc ml-4">
                                {summary.votes
                                  .filter((v) => v.point !== null && v.point !== undefined && v.point !== '')
                                  .map((v, idx) => (
                                    <li key={idx}>
                                      {v.avatar} {v.name} — <strong>{v.point}</strong>
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div key={i} className="text-sm">
                        <strong>{msg.sender}:</strong> {msg.text}
                      </div>
                    );
                  })}
                </div>
                <div className="h-5 mt-1">
                  {typingUsers.length > 0 && (
                    <p className="text-xs text-gray-500 italic">
                      {typingUsers.join(', ')}{' '}
                      {typingUsers.length === 1 ? 'is' : 'are'} typing...
                    </p>
                  )}
                </div>
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
                  <button
                    className="px-3 bg-blue-500 text-white rounded"
                    onClick={sendChatMessage}
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* ─── Scrum Master Add Story ───────────────────────────────────────────── */}
              {!sessionActive && isScrumMaster && (
                <div className="mb-6">
                  <input
                    className="p-2 border rounded w-full mb-2"
                    placeholder="Add story title"
                    value={storyTitle}
                    onChange={(e) => setStoryTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleStartSession(storyTitle, 0);
                    }}
                  />
                  <button
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    onClick={() => handleStartSession(storyTitle, 0)}
                  >
                    Add Story
                  </button>
                  {storyQueue.length > 0 && (
                    <div className="mt-4">
                      <h3 className="font-semibold mb-2">Queued Stories:</h3>
                      {storyQueue.map((title, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center bg-gray-100 hover:bg-gray-200 border text-left px-4 py-2 mb-1 rounded"
                        >
                          <button
                            className="flex-1 text-left"
                            onClick={() => handleStartSession(title, index)}
                          >
                            ▶️ {title}
                          </button>
                          <button
                            className="text-red-600 text-sm ml-2"
                            onClick={() =>
                              setStoryQueue(storyQueue.filter((_, i) => i !== index))
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!sessionActive && !isScrumMaster && (
                <p className="text-gray-500 mt-4">Waiting for Scrum Master to start the session...</p>
              )}

              {/* ─── About Modal ───────────────────────────────────────────────────────── */}
              <div className="text-center mt-6">
                <button
                  className="text-xs text-gray-500 underline"
                  onClick={() => {
                    const modal = document.getElementById('about-modal');
                    if (modal) modal.showModal();
                  }}
                >
                  About
                </button>
              </div>

              <dialog
                id="about-modal"
                className="rounded-xl p-6 max-w-lg w-full shadow-xl border bg-white text-sm text-left"
              >
                <form method="dialog" className="space-y-3">
                  <h2 className="text-lg font-semibold text-blue-700">About This App</h2>
                  <ul className="list-disc list-inside text-gray-700">
                    <li>✅ Real-time multiplayer pointing</li>
                    <li>✅ Roles: Developer, Observer, Scrum Master, Product Owner</li>
                    <li>✅ Live emoji reactions & mood status</li>
                    <li>✅ Confetti & animated consensus</li>
                    <li>✅ Revoting support</li>
                    <li>✅ Session timer & story timer</li>
                    <li>✅ Team chat + typing indicators</li>
                    <li>✅ Responsive design for mobile & desktop</li>
                    <li>✅ Avatar & emoji personalization</li>
                    <li>✅ Seamlessly rejoin when session disconnect</li>
                  </ul>
                  <p className="mt-3 text-xs text-gray-500">
                    Built with 💙 by <strong>HighWind</strong>
                  </p>
                  <div className="text-right mt-4">
                    <button className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600">
                      Close
                    </button>
                  </div>
                </form>
              </dialog>
            </>
          )}
        </div>
      </div>
    </div>
  );
}