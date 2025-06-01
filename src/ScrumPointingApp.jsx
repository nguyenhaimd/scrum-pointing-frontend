// src/ScrumPointingApp.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import Joyride from 'react-joyride';
import Confetti from 'react-confetti';
import { useWindowSize } from '@react-hook/window-size';
import { motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';

//
// ─── UTILITY: Detect Mobile vs. Desktop ────────────────────────────────────────
//
function getDeviceType() {
  const ua = navigator.userAgent;
  return /Mobi|Android|iPhone|iPad|iPod/.test(ua) ? 'mobile' : 'desktop';
}

//
// ─── SOCKET.IO CONNECTION ─────────────────────────────────────────────────────
//
const socket = io(import.meta.env.VITE_BACKEND_URL, {
  transports: ['websocket'],
  secure: true,
  reconnectionAttempts: 5,
});

//
// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
//
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
  // ─── STATE DECLARATIONS ─────────────────────────────────────────────────────
  const [nickname, setNickname]               = useState('');
  const [room, setRoom]                       = useState('AFOSR Pega Developers');
  const [role, setRole]                       = useState('Developer');
  const [selectedAvatar, setSelectedAvatar]   = useState(
    AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)]
  );
  const [myMood, setMyMood]                   = useState('😎');
  const [rememberMe, setRememberMe]           = useState(false);
  const [hasJoined, setHasJoined]             = useState(false);

  const [storyTitle, setStoryTitle]           = useState('');
  const [storyQueue, setStoryQueue]           = useState([]);
  const [sessionActive, setSessionActive]     = useState(false);
  const [vote, setVote]                       = useState(null);
  const [votes, setVotes]                     = useState({});
  const [votesRevealed, setVotesRevealed]     = useState(false);
  const [showConfetti, setShowConfetti]       = useState(false);

  const [participants, setParticipants]       = useState([]);
  const [participantRoles, setParticipantRoles]       = useState({});
  const [participantAvatars, setParticipantAvatars]   = useState({});
  const [participantMoods, setParticipantMoods]       = useState({});
  const [participantConnections, setParticipantConnections] = useState({});
  const [devices, setDevices]                 = useState({});

  const [chatMessages, setChatMessages]       = useState([]);
  const [chatInput, setChatInput]             = useState('');
  const [reactions, setReactions]             = useState([]); // flying emoji reactions
  
  const [typingUsers, setTypingUsers]         = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [error, setError]                     = useState('');
  const [showSidebar, setShowSidebar]         = useState(false);
  const [showReactionsPanel, setShowReactionsPanel] = useState(false);

  // Dark mode and premium modal
  const [darkMode, setDarkMode]               = useState(false);
  const [showDarkPremiumModal, setShowDarkPremiumModal] = useState(false);

  // Timers & vote history
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds]     = useState(0);
  const [globalStartTime, setGlobalStartTime]   = useState(null);
  const [globalElapsedSeconds, setGlobalElapsedSeconds] = useState(0);
  const [voteStartTime, setVoteStartTime]       = useState(null);
  const [myVoteHistory, setMyVoteHistory]       = useState([]);

  const [currentUserInfo, setCurrentUserInfo]   = useState({});
  const [showAbout, setShowAbout]               = useState(false);

  // Offline check before starting a story
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [offlineList, setOfflineList] = useState([]);
  const [pendingStart, setPendingStart] = useState(null);

  // Reconnection prompt
  const [showReconnectModal, setShowReconnectModal] = useState(false);

  const [width, height] = useWindowSize();
  const chatRef = useRef(null);

  const isScrumMaster = role === 'Scrum Master';
  const isDeveloper   = role === 'Developer';
  const isObserver    = role === 'Observer' || role === 'Product Owner';

  // Guided tour (react-joyride)
  const [runTour, setRunTour] = useState(false);
  const [tourSteps, setTourSteps] = useState([]);

  // KONAMI CODE EASTER EGG
  const [konamiUnlocked, setKonamiUnlocked] = useState(false);
  const KONAMI_SEQUENCE = [
    'ArrowUp','ArrowUp',
    'ArrowDown','ArrowDown',
    'ArrowLeft','ArrowRight',
    'ArrowLeft','ArrowRight',
    'b','a'
  ];
  const [inputSequence, setInputSequence] = useState([]);

  // ─── EFFECT: Prefill from localStorage if "Remember Me" was checked ────────────
  useEffect(() => {
    const saved = localStorage.getItem('scrumUser');
    if (saved) {
      try {
        const { nickname, room, role, selectedAvatar, myMood } = JSON.parse(saved);
        setNickname(nickname || '');
        setRoom(room || 'AFOSR Pega Developers');
        setRole(role || 'Developer');
        setSelectedAvatar(selectedAvatar || AVATAR_EMOJIS[0]);
        setMyMood(myMood || '😎');
        setRememberMe(true);
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  // ─── EFFECT: Build guided‐tour steps based on role ───────────────────────────
  const buildTourSteps = useCallback(() => {
    if (!hasJoined) return [];
    if (isScrumMaster) {
      return [
        {
          target: '#tour-join-btn',
          content: 'As Scrum Master, fill in your info and click “Join.”',
          disableBeacon: true,
        },
        {
          target: '#tour-add-story',
          content: 'Type a story title here to queue it.',
        },
        {
          target: '#tour-add-story-btn',
          content: 'Click to add your story to the queue below.',
        },
        {
          target: '#tour-story-queue',
          content: 'Your queued stories appear here. Click ▶️ to start voting.',
        },
        {
          target: '#tour-participants',
          content: 'This column shows everyone’s status, mood, and device.',
        },
        {
          target: '#tour-vote-container',
          content: 'Developers vote here once a story is started.',
        },
        {
          target: '#tour-reveal-btn',
          content: 'Click “Reveal Votes” to see everyone’s estimates.',
        },
        {
          target: '#tour-chat-input',
          content: 'Team chat and vote summaries appear here.',
        },
      ];
    } else if (isDeveloper) {
      return [
        {
          target: '#tour-join-btn',
          content: 'Enter your details and click “Join.”',
          disableBeacon: true,
        },
        {
          target: '#tour-participants',
          content: 'See who’s online, their mood, and device type here.',
        },
        {
          target: '#tour-vote-container',
          content: 'Click a number to cast your estimate; it will highlight.',
        },
        {
          target: '#tour-reveal-btn',
          content: 'Wait for the Scrum Master to reveal votes.',
        },
        {
          target: '#tour-chat-input',
          content: 'Chat with your team while you wait.',
        },
      ];
    } else {
      return [
        {
          target: '#tour-join-btn',
          content: 'Enter your details and click “Join.”',
          disableBeacon: true,
        },
        {
          target: '#tour-participants',
          content: 'Check out participant status, mood, and device here.',
        },
        {
          target: '#tour-vote-container',
          content: 'As an Observer, you can watch votes but not vote yourself.',
        },
        {
          target: '#tour-reveal-btn',
          content: 'Wait for votes to be revealed by the Scrum Master.',
        },
        {
          target: '#tour-chat-input',
          content: 'Feel free to chat or send emojis while you watch.',
        },
      ];
    }
  }, [hasJoined, isScrumMaster, isDeveloper]);

  useEffect(() => {
    setTourSteps(buildTourSteps());
  }, [buildTourSteps]);

  // ─── EFFECT: KONAMI CODE LISTENER ─────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key;
      setInputSequence(prev => {
        const nextSeq = [...prev, key].slice(-KONAMI_SEQUENCE.length);
        if (nextSeq.join(',') === KONAMI_SEQUENCE.join(',')) {
          setKonamiUnlocked(true);
          // Keep it unlocked permanently; do not revert on close.
        }
        return nextSeq;
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ─── EFFECT: Session Timer ────────────────────────────────────────────────────
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

  // ─── EFFECT: Global Timer ─────────────────────────────────────────────────────
  useEffect(() => {
    let timer;
    if (globalStartTime) {
      timer = setInterval(() => {
        setGlobalElapsedSeconds(Math.floor((Date.now() - globalStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [globalStartTime]);

  // ─── SOCKET.IO LISTENERS ──────────────────────────────────────────────────────
  useEffect(() => {
    // Update story queue
    socket.on('updateStoryQueue', (queue) => {
      setStoryQueue(queue);
    });

    // Participants update (includes devices)
    socket.on('participantsUpdate', ({ names, roles, avatars, moods, connected, devices }) => {
      setParticipants(names);
      setParticipantRoles(roles || {});
      setParticipantAvatars(avatars || {});
      setParticipantMoods(moods || {});

      const connectionMap = names.reduce((acc, name) => {
        acc[name] = connected.includes(name);
        return acc;
      }, {});
      setParticipantConnections(connectionMap);

      setDevices(devices || {});
    });

    socket.on('userJoined', (user) => {
      toast.success(`🔵 ${user} joined the room.`);
    });

    socket.on('userLeft', (user) => {
      toast(`🔴 ${user} left the room.`, { icon: '👋' });
      setChatMessages(prev => [
        ...prev,
        { sender: 'System', text: `${user} disconnected.` }
      ]);
    });

    socket.on('updateVotes', (updatedVotes) => setVotes(updatedVotes));
    socket.on('typingUpdate', (users) => setTypingUsers(users.filter(u => u !== nickname)));

    // Incoming emoji reactions
    socket.on('emojiReaction', ({ sender, emoji }) => {
      // Spawn a flying emoji marker on everyone’s screen
      const id = Date.now() + Math.random();
      const randomX = Math.random() * 80 + 10; // 10%–90% across screen
      const randomY = Math.random() * 10 + 80; // start near bottom
      setReactions(prev => [
        ...prev,
        { id, sender, emoji, x: randomX, startY: randomY }
      ]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 1200);
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
      setChatMessages(prev => {
        if (msg.type === 'voteSummary') {
          // collapse previous summaries
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
  }, [nickname]);

  // ─── SCROLL CHAT TO BOTTOM ON NEW MESSAGE ─────────────────────────────────────
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // ─── CHECK CONNECTION EVERY 10s ───────────────────────────────────────────────
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

  // ─── TYPING & CHAT HANDLERS ───────────────────────────────────────────────────
  const sendChatMessage = () => {
    const text = chatInput.trim();
    if (!text) return;

    // If user typed "haifetti" (case-insensitive), trigger confetti at top level
    if (text.toLowerCase() === 'haifetti') {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 10000);
    }

    socket.emit('teamChat', { room, sender: nickname, text });
    setChatInput('');
  };

  const handleTyping = () => {
    socket.emit('userTyping');
  };

  // ─── EMOJI REACTIONS: spawn locally + emit ─────────────────────────────────
  const sendReaction = (emoji) => {
    // Locally spawn a flying emoji right away:
    const id = Date.now() + Math.random();
    const randomX = Math.random() * 80 + 10;  // between 10% and 90% horizontally
    const randomY = Math.random() * 10 + 80;  // between 80% and 90% from top
    setReactions(prev => [
      ...prev,
      { id, sender: nickname, emoji, x: randomX, startY: randomY }
    ]);
    // Remove it from local state after ~1.2 s:
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 1200);

    // Still emit to the server so everyone else sees it too:
    socket.emit('emojiReaction', { sender: nickname, emoji });
  };

  const updateMood = (emoji) => {
    setMyMood(emoji);
    socket.emit('updateMood', { nickname, emoji });
  };

  // ─── JOIN / VOTE / SESSION HANDLERS ────────────────────────────────────────────
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
    socket.emit('join', {
      nickname,
      room,
      role,
      avatar: selectedAvatar,
      emoji: myMood,
      device: getDeviceType(),
    });
    setHasJoined(true);
    setGlobalStartTime(Date.now());
    setCurrentUserInfo({ nickname, avatar: selectedAvatar, role });

    // Handle "Remember Me"
    if (rememberMe) {
      const toSave = { nickname, room, role, selectedAvatar, myMood };
      localStorage.setItem('scrumUser', JSON.stringify(toSave));
    } else {
      localStorage.removeItem('scrumUser');
    }
  };

  const castVote = (point) => {
    setVote(point);
    socket.emit('vote', { nickname, point });
    setMyVoteHistory(prev => {
      const story = storyTitle || 'Untitled Story';
      const filtered = prev.filter(item => item.story !== story);
      return [...filtered, { story, point }];
    });
  };

  const revealVotes = () => {
    socket.emit('revealVotes');
    const consensus = getConsensus();
    const voteSummary = {
      story: storyTitle || 'Untitled Story',
      votes: participants
        .filter(p => participantRoles[p] === 'Developer')
        .map(p => ({
          name:   p,
          avatar: participantAvatars[p] || '❓',
          point:  votes[p] !== null ? votes[p] : '—',
        })),
      consensus,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      expand: true,
    };
    setChatMessages(prev => {
      const updated = prev.map(m => {
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
      summary: voteSummary
    });
  };

  const endSession = () => socket.emit('endSession');

  const startSession = (title, index) => {
    socket.emit('startSession', { title, room });
    setStoryQueue(prev => prev.filter((_, i) => i !== index));
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
      .filter(p => participantRoles[p] === 'Developer')
      .filter(p => !participantConnections[p]);
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

  const logout = () => {
    socket.emit('logout');
    // Reset all local state back to initial
    setHasJoined(false);
    setNickname('');
    setRoom('AFOSR Pega Developers');
    setRole('Developer');
    setSelectedAvatar(AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)]);
    setMyMood('😎');
    setRememberMe(false);
    setStoryTitle('');
    setStoryQueue([]);
    setSessionActive(false);
    setVote(null);
    setVotes({});
    setVotesRevealed(false);
    setShowConfetti(false);
    setParticipants([]);
    setParticipantRoles({});
    setParticipantAvatars({});
    setParticipantMoods({});
    setParticipantConnections({});
    setChatMessages([]);
    setChatInput('');
    setReactions([]);
    setTypingUsers([]);
    setConnectionStatus('connected');
    setError('');
    setShowSidebar(false);
    setSessionStartTime(null);
    setElapsedSeconds(0);
    setGlobalStartTime(null);
    setGlobalElapsedSeconds(0);
    setVoteStartTime(null);
    setCurrentUserInfo({});
    setShowAbout(false);
    setShowReconnectModal(false);
    setMyVoteHistory([]);
    setKonamiUnlocked(false);
    setDarkMode(false);
    setShowDarkPremiumModal(false);
  };

  // ─── CALCULATE CONSENSUS ─────────────────────────────────────────────────────
  const totalDevelopers = participants.filter(p => participantRoles[p] === 'Developer').length;
  const votesCast = participants.filter(
    p => participantRoles[p] === 'Developer' && votes[p] !== null
  ).length;

  const getConsensus = () => {
    const values = Object.entries(votes)
      .filter(([u]) => participantRoles[u] === 'Developer')
      .map(([_, v]) => Number(v));
    if (!values.length) return [];
    const freq = values.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1; return acc;
    }, {});
    const maxFreq = Math.max(...Object.values(freq));
    return Object.entries(freq)
      .filter(([_, f]) => f === maxFreq)
      .map(([v]) => Number(v))
      .sort((a, b) => a - b);
  };
  const consensusPoints = votesRevealed ? getConsensus() : [];

  // ─── FORMAT TIME ─────────────────────────────────────────────────────────────
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ─── JSX RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className={darkMode ? 'dark' : ''}>
      <div
        className={`min-h-screen p-4 font-sans text-gray-800 dark:text-gray-100 ${
          konamiUnlocked
            ? '' 
            : 'bg-gradient-to-br from-sky-100 to-blue-200 dark:from-gray-800 dark:to-gray-900'
        }`}
        style={
          konamiUnlocked
            ? {
                background: 'linear-gradient(135deg, #070047 0%, #211A50 50%, #BD0EFF 100%)'
              }
            : {}
        }
      >
        <Toaster position="top-right" reverseOrder={false} />

        {/* ─── TOP-LEVEL CONFETTI (for “haifetti” or votes) ───────────────────────── */}
        {showConfetti && <Confetti width={width} height={height} />}

        {/* ─── FLYING EMOJI REACTIONS ──────────────────────────────────────────────── */}
        <div className="fixed inset-0 z-50 pointer-events-none">
          {reactions.map(r => (
            <motion.div
              key={r.id}
              className="absolute text-center"
              style={{ left: `${r.x}%`, top: `${r.startY}%` }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, y: `-${r.startY + 10}vh`, scale: 1.2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
            >
              <div className="text-4xl">{r.emoji}</div>
              <div className="text-xs text-gray-600 dark:text-gray-300">{r.sender}</div>
            </motion.div>
          ))}
        </div>

        {/* ─── GUIDED TOUR ───────────────────────────────────────────────────────── */}
        <Joyride
          steps={tourSteps}
          run={runTour}
          continuous={true}
          scrollToFirstStep={true}
          showSkipButton={true}
          styles={{ options: { zIndex: 10000 } }}
          callback={(data) => {
            const { status } = data;
            if (['finished', 'skipped'].includes(status)) {
              setRunTour(false);
            }
          }}
        />

        {/* ─── KONAMI EASTER EGG MODAL ───────────────────────────────────────────── */}
        {konamiUnlocked && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg text-center max-w-sm">
              <h2 className="text-2xl font-bold text-purple-700 mb-4 dark:text-purple-300">
                🎉 Konami Unlocked! 🎉
              </h2>
              <p className="mb-4 text-gray-800 dark:text-gray-200">
                Gaming Mode activated! Enjoy the new background. 🌌
              </p>
              <button
                className="bg-purple-600 dark:bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-700 dark:hover:bg-purple-600"
                onClick={() => {/* Do not clear konamiUnlocked; keep gaming background */}}
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* ─── DARK MODE PREMIUM MODAL ─────────────────────────────────────────────── */}
        {showDarkPremiumModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg text-center max-w-md">
              <h2 className="text-xl font-semibold mb-3 dark:text-gray-200">
                ☕ Dark Mode is a Premium Feature ☕
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Dark mode is only for team members willing to go get coffee at the last minute
                before an important meeting on your first day on the job with a coworker that
                promised they will speak up on your behalf if things go astray.
              </p>
              <button
                className="bg-green-600 dark:bg-green-700 text-white px-4 py-2 rounded hover:bg-green-700 dark:hover:bg-green-600"
                onClick={() => setShowDarkPremiumModal(false)}
              >
                I’ll Go Get Coffee ☕
              </button>
            </div>
          </div>
        )}

        {/* ─── TOP BAR: Dark Mode Toggle + Guided Tour + User Info ───────────────── */}
        <div className="flex justify-between items-center mb-4">
          {/* Dark Mode Toggle */}
          <button
            onClick={() => {
              setDarkMode(!darkMode);
              if (!darkMode) setShowDarkPremiumModal(true);
            }}
            className="text-xl bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 hover:bg-gray-300 p-2 rounded-full transition"
            title="Toggle Dark Mode"
          >
            {darkMode ? '☀️' : '☾'}
          </button>

          {hasJoined && (
            <button
              onClick={() => setRunTour(true)}
              className="text-sm bg-blue-500 dark:bg-blue-700 text-white px-3 py-1 rounded hover:bg-blue-600 dark:hover:bg-blue-600 transition"
              title="Start Guided Tour"
            >
              Start Guided Tour
            </button>
          )}

          {hasJoined && (
            <div className="flex items-center space-x-2">
              <span className="text-xs dark:text-gray-300">You are:</span>
              <span className="text-2xl">{currentUserInfo.avatar}</span>
              <span className="font-bold">{currentUserInfo.nickname}</span>
              <span className="text-xs">({currentUserInfo.role})</span>
              {isScrumMaster && (
                <button
                  id="tour-end-session"
                  className="bg-red-800 dark:bg-red-900 text-white px-3 py-1 rounded hover:bg-red-900 dark:hover:bg-red-700 text-xs whitespace-nowrap ml-4"
                  onClick={() => socket.emit('endPointingSession')}
                >
                  End Session
                </button>
              )}
            </div>
          )}
        </div>

        {/* ─── REACTIONS & MOOD PANEL (Collapsible) ───────────────────────────────── */}
        {hasJoined && (
          <div className="mb-4">
            <button
              className="text-sm text-blue-600 dark:text-blue-300 underline"
              onClick={() => setShowReactionsPanel(prev => !prev)}
            >
              {showReactionsPanel ? 'Hide Reactions & Moods' : 'Show Reactions & Moods'}
            </button>
            {showReactionsPanel && (
              <div className="mt-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-3 shadow-sm">
                {/* Mood Selector */}
                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Your Current Mood:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(MOOD_OPTIONS).map(([emoji, label]) => (
                      <button
                        key={emoji}
                        onClick={() => updateMood(emoji)}
                        className={`text-2xl px-2 py-1 rounded-full transition ${
                          myMood === emoji
                            ? 'bg-blue-100 border border-blue-500'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        title={label}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Emoji Reactions */}
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Send a Quick Emoji Reaction:
                  </div>
                  <div className="flex flex-wrap gap-3">
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
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── STICKY CURRENT STORY BANNER ────────────────────────────────────────── */}
        {hasJoined && sessionActive && (
          <div className="sticky top-0 bg-blue-200 dark:bg-blue-900 text-center py-2 font-semibold text-blue-800 dark:text-blue-200 mb-4 rounded">
            Current Story: {storyTitle}
          </div>
        )}

        {/* ─── POLISHED JOIN SCREEN ───────────────────────────────────────────────────── */}
        {!hasJoined ? (
          <div className="flex items-center justify-center h-full">
            {/* Card Container */}
            <div className="w-full max-w-md bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl shadow-lg p-8 space-y-6">
              {/* Title */}
              <h1 className="text-3xl font-extrabold text-center text-blue-700 dark:text-blue-400 mb-4">
                Join the Pointing Session
              </h1>

              {/* Error Message */}
              {error && (
                <p className="text-center text-red-500 bg-red-50 dark:bg-red-800 dark:text-red-300 px-4 py-2 rounded">
                  {error}
                </p>
              )}

              {/* Inputs */}
              <div className="space-y-4">
                {/* Team Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Team Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition"
                    placeholder="e.g. AFOSR Pega Developers"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                  />
                </div>

                {/* Nickname */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nickname
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition"
                    placeholder="What should we call you?"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                  />
                </div>

                {/* Role Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role
                  </label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none px-4 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg
                        className="h-5 w-5 text-gray-400 dark:text-gray-500"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Avatar Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Pick an Avatar
                  </label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none px-4 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-2xl text-center focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 transition"
                      value={selectedAvatar}
                      onChange={(e) => setSelectedAvatar(e.target.value)}
                    >
                      {AVATAR_EMOJIS.map((emoji) => (
                        <option key={emoji} value={emoji}>
                          {emoji}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-gray-400 dark:text-gray-500">😃</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    (This will appear next to your name in‐session)
                  </p>
                </div>

                {/* Mood Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Your Current Mood
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(MOOD_OPTIONS).map(([emoji, label]) => (
                      <button
                        key={emoji}
                        onClick={() => setMyMood(emoji)}
                        className={`text-2xl px-2 py-1 rounded-full transition ${
                          myMood === emoji
                            ? 'bg-blue-100 border border-blue-500'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        title={label}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Remember Me Toggle */}
                <div className="flex items-center space-x-2">
                  <input
                    id="remember-me-checkbox"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={() => setRememberMe(prev => !prev)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="remember-me-checkbox"
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    Remember me
                  </label>
                </div>
              </div>

              {/* Join Button */}
              <button
                id="tour-join-btn"
                className="w-full bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white font-bold py-3 rounded-lg transform hover:scale-105 transition"
                onClick={join}
              >
                Join Session
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ─── After Joining: Main Application Content ─────────────────────────── */}

            {/* ─── Sidebar + Main Layout ────────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row gap-4">
              {/* ─── Sidebar (Participants) ─────────────────────────────────────────── */}
              <div className={`lg:w-1/4 w-full ${hasJoined ? '' : 'hidden'}`}>
                {/* Mobile collapse toggle */}
                {width < 1024 && (
                  <div className="flex justify-between items-center mb-2 px-2">
                    <span className="font-semibold dark:text-gray-300">Users in session</span>
                    <button
                      className="text-sm text-blue-600 dark:text-blue-300 underline"
                      onClick={() => setShowSidebar(!showSidebar)}
                    >
                      {showSidebar ? 'Hide' : 'Show'}
                    </button>
                  </div>
                )}

                {(showSidebar || width >= 1024) && (
                  <div
                    id="tour-participants"
                    className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded p-3 shadow text-sm flex flex-col h-[calc(100vh-4rem)]"
                  >
                    {/* Sticky header */}
                    <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 pb-2 pt-1">
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-gray-600 pb-1">
                        👥 Online: {Object.values(participantConnections).filter(Boolean).length} / {participants.length}
                      </div>
                      <div className="mb-3 text-sm text-center text-blue-700 dark:text-blue-300 font-medium">
                        ⏱️ Elapsed: {formatTime(globalElapsedSeconds)}
                      </div>
                    </div>

                    {/* All participants */}
                    <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar rounded-md">
                      {participants.map(p => {
                        const isConnected = participantConnections[p];
                        const roleName    = participantRoles[p];
                        const mood        = participantMoods[p];
                        const deviceType  = devices[p];
                        return (
                          <div
                            key={p}
                            className="h-12 flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg px-3 shadow-sm"
                          >
                            <div className="flex items-center gap-3">
                              {roleName === 'Scrum Master' ? (
                                <motion.span
                                  className="text-2xl"
                                  animate={{ scale: [1, 1.1, 1] }}
                                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                                >
                                  {participantAvatars[p] || '❓'} 👑
                                </motion.span>
                              ) : (
                                <span className="text-2xl">{participantAvatars[p] || '❓'}</span>
                              )}
                              <div className="flex flex-col">
                                <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                                  {p}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {roleName}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className={isConnected
                                ? 'text-green-600 dark:text-green-400 font-medium'
                                : 'text-red-500 dark:text-red-400 font-medium'
                              }>
                                {isConnected ? '🟢 Online' : '🔴 Offline'}
                              </span>
                              {mood && (
                                <span className="text-gray-500 dark:text-gray-400">{mood}</span>
                              )}
                              <span>{deviceType === 'mobile' ? '📱' : '💻'}</span>
                              {isScrumMaster && !isConnected && (
                                <button
                                  className="text-red-500 dark:text-red-400 hover:underline text-xs"
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
                    {participants.filter(p => !participantConnections[p]).length > 0 && (
                      <OfflineSection
                        participants={participants}
                        connections={participantConnections}
                        roles={participantRoles}
                        moods={participantMoods}
                        devices={devices}
                        isScrumMaster={isScrumMaster}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* ─── Main Content (Voting, Chat, Queue) ─────────────────────────────── */}
              <div className="flex-1">
                {sessionActive && (
                  <>
                    <h2 className="text-xl font-bold mb-4 text-blue-800 dark:text-blue-400">
                      Voting for: {storyTitle}
                    </h2>

                    {(isScrumMaster || isObserver) && (
                      <div className="mt-4 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 p-3 rounded">
                        <p className="font-semibold mb-2">Voting Progress:</p>
                        <progress
                          className="w-full h-3 mb-2"
                          value={votesCast}
                          max={totalDevelopers}
                        />
                        <ul className="text-sm">
                          {participants
                            .filter(p => participantRoles[p] === 'Developer')
                            .map(p => (
                              <li key={p}>
                                {participantAvatars[p] || '❓'} {p} —{' '}
                                {votes[p] ? '✅ Voted' : '⏳ Waiting'}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}

                    {isObserver && (
                      <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 p-3 rounded mt-4 text-sm text-gray-800 dark:text-gray-200">
                        👀 You are observing this session. You can’t vote but can watch
                        everything.
                      </div>
                    )}

                    {isDeveloper && !votesRevealed && (
                      <motion.div
                        id="tour-vote-container"
                        className="grid grid-cols-3 gap-4 mb-4 mt-6"
                        animate={vote === null ? { scale: [1, 1.05, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                      >
                        {POINT_OPTIONS.map(pt => (
                          <motion.button
                            key={pt}
                            className={`
                              py-4 px-6 rounded-xl font-bold text-xl shadow transition
                              ${
                                vote === pt
                                  ? 'bg-green-500 text-white border border-green-600'
                                  : 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-gray-600'
                              }
                            `}
                            onClick={() => castVote(pt)}
                            whileTap={{ scale: 0.9 }}
                            animate={vote === pt ? { scale: [1, 1.1, 1] } : {}}
                            transition={{ duration: 0.4 }}
                          >
                            {pt}
                          </motion.button>
                        ))}
                        {vote && (
                          <div className="col-span-3 bg-green-50 dark:bg-green-900 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 rounded p-3 text-sm text-center shadow-sm mt-2">
                            ✅ You can update your vote at any time until the Scrum Master
                            reveals it.
                          </div>
                        )}
                      </motion.div>
                    )}

                    {vote && (
                      <p className="text-green-600 dark:text-green-400 text-lg font-semibold mb-4">
                        You voted: {vote}
                      </p>
                    )}

                    {votesRevealed && (
                      <>
                        <div className="mt-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                          <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
                            Votes
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {Object.entries(votes)
                              .filter(([user, pt]) =>
                                participantRoles[user] === 'Developer' &&
                                pt !== null && pt !== undefined && pt !== ''
                              )
                              .map(([user, pt]) => (
                                <motion.div
                                  key={user}
                                  className="bg-white dark:bg-gray-700 rounded-lg p-3 flex items-center gap-2 shadow"
                                  initial={{ rotateY: -90 }}
                                  animate={{ rotateY: 0 }}
                                  transition={{ duration: 0.4 }}
                                  style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
                                >
                                  <span className="text-2xl">{participantAvatars[user] || '❓'}</span>
                                  <div>
                                    <div className="font-semibold text-gray-800 dark:text-gray-100">
                                      {user}
                                    </div>
                                    <div className="text-xl text-blue-600 dark:text-blue-300">
                                      {pt}
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                          </div>
                        </div>
                        {consensusPoints.length > 0 && (
                          <motion.p
                            className="text-lg text-center mt-4 text-green-700 dark:text-green-300 font-bold"
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
                            id="tour-reveal-btn"
                            className="bg-purple-600 dark:bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-700 dark:hover:bg-purple-600"
                            onClick={revealVotes}
                          >
                            Reveal Votes
                          </button>
                        )}
                        {votesRevealed && (
                          <button
                            className="bg-yellow-500 dark:bg-yellow-700 text-white px-4 py-2 rounded hover:bg-yellow-600 dark:hover:bg-yellow-600"
                            onClick={initiateRevote}
                          >
                            Revote
                          </button>
                        )}
                        <button
                          className="bg-red-600 dark:bg-red-700 text-white px-4 py-2 rounded hover:bg-red-700 dark:hover:bg-red-600"
                          onClick={endSession}
                        >
                          Next Story/Defect
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* ─── Chat Section ─────────────────────────────────────────────────── */}
                <div className="text-left text-sm mb-4">
                  <h3 className="font-semibold mb-1 text-gray-800 dark:text-gray-200">
                    Team Chat
                  </h3>
                  <div
                    id="tour-chat-input"
                    ref={chatRef}
                    className="h-32 lg:h-64 overflow-y-auto bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded p-2"
                  >
                    {chatMessages.map((msg, i) => {
                      if ((!msg.text && !msg.type) || (!msg.text && msg.sender === 'System'))
                        return null;

                      if (msg.type === 'voteSummary' && isScrumMaster) {
                        const { summary } = msg;
                        return (
                          <div
                            key={i}
                            className="border dark:border-gray-600 rounded p-2 bg-blue-50 dark:bg-blue-900 text-xs mt-2"
                          >
                            <div className="font-semibold flex justify-between items-center text-gray-800 dark:text-gray-100">
                              📝 Summary for "{summary.story}"
                              <button
                                onClick={() => {
                                  setChatMessages(prev =>
                                    prev.map((m, idx) =>
                                      idx === i
                                        ? { ...m, summary: { ...m.summary, expand: !m.summary.expand } }
                                        : { ...m, summary: { ...m.summary, expand: false } }
                                    )
                                  );
                                }}
                                className="text-blue-600 dark:text-blue-400 underline ml-2 text-xs"
                              >
                                {summary.expand ? 'Hide' : 'Show'}
                              </button>
                            </div>
                            {summary.expand && (
                              <div className="mt-1">
                                <div className="text-green-700 dark:text-green-300 mb-1">
                                  📊 Consensus: {summary.consensus.join(', ')}
                                </div>
                                <ul className="list-disc ml-4 text-gray-800 dark:text-gray-200">
                                  {summary.votes
                                    .filter(
                                      v => v.point !== null && v.point !== undefined && v.point !== ''
                                    )
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
                        <div className="text-sm text-gray-800 dark:text-gray-200" key={i}>
                          <strong>{msg.sender}:</strong> {msg.text}
                        </div>
                      );
                    })}
                  </div>
                  <div className="h-5 mt-1">
                    {typingUsers.length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                      </p>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      className="flex-1 border p-1 rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                      placeholder="Type a message..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') sendChatMessage();
                        else handleTyping();
                      }}
                    />
                    <button
                      className="px-3 bg-blue-500 dark:bg-blue-700 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-600"
                      onClick={sendChatMessage}
                    >
                      Send
                    </button>
                  </div>
                </div>

                {/* ─── Scrum Master: Add / Manage Story Queue ─────────────────────── */}
                {!sessionActive && isScrumMaster && (
                  <div className="mb-6">
                    <input
                      id="tour-add-story"
                      className="p-2 border rounded w-full mb-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                      placeholder="Add story title"
                      value={storyTitle}
                      onChange={e => setStoryTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && storyTitle.trim()) {
                          socket.emit('updateStoryQueue', [...storyQueue, storyTitle.trim()]);
                          setStoryQueue(prev => [...prev, storyTitle.trim()]);
                          setStoryTitle('');
                        }
                      }}
                    />
                    <button
                      id="tour-add-story-btn"
                      className="bg-blue-500 dark:bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-600 dark:hover:bg-blue-600"
                      onClick={() => {
                        if (storyTitle.trim()) {
                          socket.emit('updateStoryQueue', [...storyQueue, storyTitle.trim()]);
                          setStoryQueue(prev => [...prev, storyTitle.trim()]);
                          setStoryTitle('');
                        }
                      }}
                    >
                      Add Story
                    </button>
                    {storyQueue.length > 0 && (
                      <div id="tour-story-queue" className="mt-4">
                        <h3 className="font-semibold mb-2 text-gray-800 dark:text-gray-200">
                          Queued Stories:
                        </h3>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                          {storyQueue.map((title, index) => (
                            <div
                              key={index}
                              className="flex justify-between items-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border dark:border-gray-600 text-left px-4 py-2 rounded"
                            >
                              <button
                                className="flex-1 text-left text-gray-800 dark:text-gray-200"
                                onClick={() => handleStartSession(title, index)}
                              >
                                ▶️ {title}
                              </button>
                              <button
                                className="text-red-600 dark:text-red-400 text-sm ml-2 hover:text-red-800 dark:hover:text-red-600"
                                onClick={() => {
                                  const newQueue = storyQueue.filter((_, i) => i !== index);
                                  socket.emit('updateStoryQueue', newQueue);
                                  setStoryQueue(newQueue);
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!sessionActive && !isScrumMaster && (
                  <p className="text-gray-500 dark:text-gray-400 mt-4">
                    Waiting for Scrum Master to start the session...
                  </p>
                )}

                {/* ─── About Modal ───────────────────────────────────────────────────────── */}
                <div className="text-center mt-6">
                  <button
                    className="text-xs text-gray-500 dark:text-gray-400 underline"
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
                  className="rounded-xl p-6 max-w-lg w-full shadow-xl border dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-left"
                >
                  <form method="dialog" className="space-y-3">
                    <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                      About This App
                    </h2>
                    <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                      <li>✅ Real‐time multiplayer pointing via Socket.IO</li>
                      <li>✅ Roles: Developer, Observer, Product Owner, Scrum Master</li>
                      <li>✅ Device detection (desktop 💻 vs. mobile 📱) with icons</li>
                      <li>✅ Online/offline status & reconnection grace period</li>
                      <li>✅ Mood selector and “randomly flying” emoji reactions</li>
                      <li>✅ “haifetti” chat keyword triggers a confetti rain</li>
                      <li>✅ Revote support + animated flip‐card vote reveal</li>
                      <li>✅ Confetti celebration when votes are revealed</li>
                      <li>✅ Scrum Master protection: only one per room + removal of offline users</li>
                      <li>✅ Story queue management: add, remove, play next story</li>
                      <li>✅ Sticky banner showing the current story on top</li>
                      <li>✅ Chat with typing indicators and vote summary cards</li>
                      <li>✅ Sidebar participants list with fixed‐height, scrollable container</li>
                      <li>✅ Collapsible “Offline” section within the participants list</li>
                      <li>✅ Remember Me toggle on the Join screen (localStorage)</li>
                      <li>✅ Responsive design for desktop and mobile devices</li>
                      <li>✅ Konami code Easter egg that unlocks a gaming‐themed background</li>
                      <li>✅ Guided tour (react‐joyride) for each role, with skip option</li>
                      <li>✅ Personal vote history visible to developers</li>
                      <li>✅ Error handling and reconnect prompts when disconnected</li>
                      <li>✅ Polished UI with micro-animations (input focus, button hover/press)</li>
                    </ul>
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      Built with 💙 by <strong>HighWind</strong>
                    </p>
                    <div className="text-right mt-4">
                      <button className="bg-blue-500 dark:bg-blue-700 text-white px-4 py-1 rounded hover:bg-blue-600 dark:hover:bg-blue-600">
                        Close
                      </button>
                    </div>
                  </form>
                </dialog>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

//
// ─── OFFLINE SECTION COMPONENT ─────────────────────────────────────────────────
//
function OfflineSection({ participants, connections, roles, moods, devices, isScrumMaster }) {
  const [showOffline, setShowOffline] = useState(false);
  const offlineParticipants = participants.filter(p => !connections[p]);

  return (
    <div className="mt-4">
      <button
        className="w-full flex justify-between items-center text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded"
        onClick={() => setShowOffline(prev => !prev)}
      >
        <span>🔴 Offline ({offlineParticipants.length})</span>
        <span>{showOffline ? '▲' : '▼'}</span>
      </button>

      {showOffline && (
        <div className="mt-2 grid grid-cols-1 gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar rounded-md">
          {offlineParticipants.map(p => {
            const roleName    = roles[p];
            const mood        = moods[p];
            const deviceType  = devices[p];
            return (
              <div
                key={p}
                className="h-12 flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg px-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">❓</span>
                  <div className="flex flex-col">
                    <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                      {p}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {roleName}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-red-500 dark:text-red-400 font-medium">
                    🔴 Offline
                  </span>
                  {mood && (
                    <span className="text-gray-500 dark:text-gray-400">{mood}</span>
                  )}
                  <span>{deviceType === 'mobile' ? '📱' : '💻'}</span>
                  {isScrumMaster && (
                    <button
                      className="text-red-500 dark:text-red-400 hover:underline text-xs"
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
  );
}