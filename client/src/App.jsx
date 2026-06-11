import './App.css';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';

import {
  TextField,
  Label,
  TextArea,
} from 'react-aria-components/TextField';

import Button from "@mui/material/Button";
import { buttonStyles } from "./utils/muiStyles.js";

function App() {
  return (
    <div className="page">
      <Navbar />

      <div className="text-field-container">
        
        <div className="text-field-button-container">
          <TextField>
            <Label>Maintenance Note</Label>
            <TextArea
              className="react-aria-TextArea"
              placeholder="Enter note here..."
            />
          </TextField>
          <Button type="submit" variant="contained" sx={buttonStyles}>
              Submit
          </Button>
        </div>

        <TextField>
          <Label>AI Note</Label>
          <TextArea
          readOnly
            className="react-aria-TextArea"
            placeholder="Waiting for AI response..."
          />
        </TextField>
      </div>
      <Footer />
    </div>
  );
}

export default App;