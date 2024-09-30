import React from 'react';
import Profile from '../components/Profile';
import heroVideo from '../assets/videos/hero.mp4';

const Home: React.FC = () => {
  return (
    <div className="home">
      <Profile />
      {/* První video */}
      <div className="video-container">
        <video autoPlay muted loop className="background-video" playsInline>
          <source src={heroVideo} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
};

export default Home;
