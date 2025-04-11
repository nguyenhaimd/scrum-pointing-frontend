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

export default function ScrumPointingApp() {
  const [nickname, setNickname] = useState('');
  const [room, setRoom] = useState('');
  const [role, setRole] = useState('Developer');
  const [hasJoined, setHasJoined] = useState(false);
  const [storyTitle, setStoryTitle] = useState('');
  const [storyQueue, setStoryQueue] = useState([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [vote, setVote] = useState(null);
  const [votes, setVotes] = useState({});
  const [votesRevealed, setVotesRevealed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [width, height] = useWindowSize();

  useEffect(() => {
    socket.on('startSession', (title) => {
      setStoryTitle(title);
      setSessionActive(true);
      setVotes({});
      setVote(null);
      setVotesRevealed(false);
    });

    socket.on('updateVotes', (updatedVotes) => {
      setVotes(updatedVotes);
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

    socket.on('participantsUpdate', (names) => {
      setParticipants(names);
    });

    return () => {
      socket.off('startSession');
      socket.off('updateVotes');
      socket.off('revealVotes');
      socket.off('sessionEnded');
      socket.off('participantsUpdate');
    };
  }, []);

  const join = () => {
    if (nickname.trim() && room.trim()) {
      socket.emit('join', { nickname, room });
      setHasJoined(true);
    }
  };

  const addStoryToQueue = () => {
    if (storyTitle.trim()) {
      setStoryQueue([...storyQueue, storyTitle]);
      setStoryTitle('');
    }
  };

  const startSession = (title, index) => {
    socket.emit('startSession', { title, room });
    setSessionActive(true);
    setVotes({});
    setVote(null);
    setVotesRevealed(false);
    setShowConfetti(false);
    setStoryQueue(storyQueue.filter((_, i) => i !== index));
  };

  const castVote = (point) => {
    setVote(point);
    socket.emit('vote', { nickname, point });
  };

  const revealVotes = () => {
    socket.emit('revealVotes');
  };

  const endSession = () => {
    socket.emit('endSession');
  };

  const isScrumMaster = role === 'Scrum Master';
  const isDeveloper = role === 'Developer';
  const isObserver = role === 'Observer';

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 to-blue-200 p-6 font-sans text-gray-800">
      <div className="max-w-2xl mx-auto bg-white shadow-xl rounded-2xl p-6">
        {!hasJoined ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4 text-blue-700">Join the Pointing Session</h1>
            <input
              className="p-2 border rounded w-full mb-2"
              placeholder="Room name"
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
              className="p-2 border rounded w-full mb-4"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition" onClick={join}>
              Join
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-600 mb-2">
              💬 Room: <span className="font-bold text-blue-800">{room}</span>
            </h2>
            {!sessionActive && isScrumMaster && (
              <div className="mb-6">
                <input
                  className="p-2 border rounded w-full mb-2"
                  placeholder="Add story title"
                  value={storyTitle}
                  onChange={(e) => setStoryTitle(e.target.value)}
                />
                <button
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  onClick={addStoryToQueue}
                >
                  Add Story
                </button>
                {storyQueue.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2">Queued Stories:</h3>
                    {storyQueue.map((title, index) => (
                      <button
                        key={index}
                        className="bg-gray-100 hover:bg-gray-200 border w-full text-left px-4 py-2 mb-1 rounded"
                        onClick={() => startSession(title, index)}
                      >
                        ▶️ {title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sessionActive && (
              <div>
                <h2 className="text-xl font-bold mb-4 text-blue-800">Voting for: {storyTitle}</h2>
                {isDeveloper ? (
                  vote ? (
                    <p className="text-green-600 text-lg font-semibold mb-4">You voted: {vote}</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-4 mb-4">
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
                  )
                ) : isScrumMaster ? (
                  <div className="flex justify-center gap-4 mt-4">
                    {!votesRevealed && (
                      <button className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700" onClick={revealVotes}>
                        Reveal Votes
                      </button>
                    )}
                    <button className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700" onClick={endSession}>
                      End Session
                    </button>
                  </div>
                ) : (
                  <p className="italic text-gray-500">You are observing this session.</p>
                )}

                {votesRevealed && (
                  <>
                    {showConfetti && <Confetti width={width} height={height} />}
                    <div className="mt-6 bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-2">Votes</h3>
                      <ul className="text-left inline-block">
                        {Object.entries(votes).map(([user, pt]) => (
                          <li key={user}>
                            <strong>{user}</strong>: {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {isScrumMaster && (
                  <div className="mt-6 text-left">
                    <h3 className="font-semibold mb-2">Voting Progress (Developers Only)</h3>
                    <ul className="bg-gray-100 rounded p-3 text-sm">
                      {participants
                        .filter((name) => name !== nickname && !name.toLowerCase().includes('observer'))
                        .map((name) => (
                          <li key={name} className="flex justify-between mb-1">
                            <span>{name}</span>
                            <span className={votes[name] ? 'text-green-600' : 'text-yellow-600'}>
                              {votes[name] ? '✅ Voted' : '⏳ Waiting'}
                            </span>
                          </li>
                        ))}
                    </ul>
                    <div className="mt-4">
                      <h3 className="font-semibold mb-2">All Participants</h3>
                      <ul className="bg-gray-50 rounded p-3 text-sm">
                        {participants.map((name) => (
                          <li key={name}>👤 {name}</li>
                        ))}
                      </ul>
                    </div>
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