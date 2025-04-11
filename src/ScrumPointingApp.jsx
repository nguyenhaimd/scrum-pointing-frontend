import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Confetti from 'react-confetti';
import { useWindowSize } from '@react-hook/window-size';

const socket = io(import.meta.env.VITE_BACKEND_URL, {
  transports: ['websocket'],
  secure: true,
});

const POINT_OPTIONS = [1, 2, 3, 5, 8, 13];
const ROLE_OPTIONS = ['Developer', 'Observer', 'Scrum Master'];
const AVATAR_EMOJIS = [
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
  '🦁','🐮','🐷','🐸','🐵','🦄','🐙','🐳','🐢','🐤',
  '🐝','🦋','🦀','🦓','🦒','🦘','🦥','🦦','🦨','🦡',
  '🦧','🦬','🐫','🐪','🐘','🐊','🦍','🐎','🐖','🐏',
  '🐑','🐐','🦌','🐓','🦃','🕊️','🐇','🐿️','🦝','🦛'
];

export default function ScrumPointingApp() {
  const getRandomAvatar = () => AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];

  const [nickname, setNickname] = useState('');
  const [room, setRoom] = useState('');
  const [role, setRole] = useState('Developer');
  const [selectedAvatar, setSelectedAvatar] = useState(getRandomAvatar());
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
  const [roomMessages, setRoomMessages] = useState([]);
  const [error, setError] = useState('');
  const [width, height] = useWindowSize();

  const isScrumMaster = role === 'Scrum Master';
  const isDeveloper = role === 'Developer';
  const isObserver = role === 'Observer';

  const totalDevelopers = participants.filter(p => participantRoles[p] === 'Developer').length;
  const votesCast = Object.keys(votes).filter(p => participantRoles[p] === 'Developer').length;
  useEffect(() => {
    socket.on('participantsUpdate', ({ names, roles, avatars }) => {
      setParticipants(names);
      setParticipantRoles(roles || {});
      setParticipantAvatars(avatars || {});
    });

    socket.on('userJoined', (user) => {
      setRoomMessages(prev => [...prev, `🔵 ${user} joined the room.`]);
    });

    socket.on('userLeft', (user) => {
      setRoomMessages(prev => [...prev, `🔴 ${user} left the room.`]);
    });

    socket.on('updateVotes', (updatedVotes) => {
      setVotes(updatedVotes);
    });

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

    return () => {
      socket.off('participantsUpdate');
      socket.off('userJoined');
      socket.off('userLeft');
      socket.off('updateVotes');
      socket.off('startSession');
      socket.off('revealVotes');
      socket.off('sessionEnded');
      socket.off('teamChat');
    };
  }, []);

  const sendChatMessage = () => {
    if (chatInput.trim()) {
      socket.emit('teamChat', { room, sender: nickname, text: chatInput });
      setChatInput('');
    }
  };

  const join = () => {
    setError('');
    if (!nickname.trim() || !room.trim()) {
      setError('Room name and nickname are required.');
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
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 to-blue-200 p-6 font-sans text-gray-800">
      <div className="max-w-2xl mx-auto bg-white shadow-xl rounded-2xl p-6">
        {!hasJoined ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4 text-blue-700">Join the Pointing Session</h1>
            {error && <p className="text-red-500 mb-2">{error}</p>}
            <input className="p-2 border rounded w-full mb-2" placeholder="Room name" value={room} onChange={(e) => setRoom(e.target.value)} />
            <input className="p-2 border rounded w-full mb-2" placeholder="Nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            <select className="p-2 border rounded w-full mb-2" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select className="p-2 border rounded w-full mb-2" value={selectedAvatar} onChange={(e) => setSelectedAvatar(e.target.value)}>
              {AVATAR_EMOJIS.map((emoji) => (
                <option key={emoji} value={emoji}>{emoji}</option>
              ))}
            </select>
            <div className="text-xl mt-2 text-center">
              Selected Avatar: <span className="text-3xl">{selectedAvatar}</span>
            </div>
            <button className="bg-blue-600 text-white px-6 py-2 mt-4 rounded hover:bg-blue-700 transition" onClick={join}>Join</button>
          </div>
        ) : (
          <div>
            <div className="mb-4 text-sm">
              {roomMessages.length > 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 text-sm mb-4 rounded">
                  {roomMessages.map((msg, idx) => <div key={idx}>{msg}</div>)}
                </div>
              )}
              <div className="mb-4 bg-white border rounded p-3 shadow text-sm">
                <h3 className="font-semibold mb-2">Users in this session:</h3>
                <div className="grid grid-cols-2 gap-2">
                  {participants.map((p) => (
                    <div key={p} className="flex items-center gap-2">
                      <span className="text-2xl">{participantAvatars[p] || '❓'}</span>
                      <span>{p} ({participantRoles[p]})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-left text-sm mb-4">
              <h3 className="font-semibold mb-1">Team Chat</h3>
              <div className="h-32 overflow-y-auto bg-gray-50 border rounded p-2">
                {chatMessages.map((msg, i) => (
                  <div key={i}><strong>{msg.sender}:</strong> {msg.text}</div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  className="flex-1 border p-1 rounded"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                />
                <button className="px-3 bg-blue-500 text-white rounded" onClick={sendChatMessage}>Send</button>
              </div>
            </div>

            {sessionActive && (
              <div>
                <h2 className="text-xl font-bold mb-4 text-blue-800">Voting for: {storyTitle}</h2>

                {isScrumMaster && !votesRevealed && (
                  <>
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
                    <div className="flex justify-center gap-4 mt-4">
                      <button className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700" onClick={revealVotes}>Reveal Votes</button>
                      <button className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700" onClick={endSession}>End Session</button>
                    </div>
                  </>
                )}

                {isObserver && (
                  <p className="text-blue-600 italic text-sm mt-4">👀 You are observing this session and cannot vote.</p>
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
                        {Object.entries(votes).map(([user, pt]) => (
                          <li key={user}><strong>{participantAvatars[user] || '❓'} {user}</strong>: {pt}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
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
          </div>
        )}
      </div>
    </div>
  );
}