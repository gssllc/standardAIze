import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000/api/landingPage")
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch((err) => console.error("Error fetching message:", err));
  }, []);

  return (
    <main>
      <img
        className="logo"
        src="/logo.svg"
        alt="Logo"
      />
    </main>
  );
}

export default App;