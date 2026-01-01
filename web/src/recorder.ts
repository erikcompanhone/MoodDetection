import RecordList from './recordList.ts';

// input for stt for sending to gemini
interface Transcript {
  uid: string;
  text: string;
  confidence?: number;
}

// inpiy from gemini
interface Mood {
  uid: string;
  mood: string;
  confidence: number;
  evidence?: string;
}

// combining records to send to firestore
interface Response {
  transcript: Transcript;
  mood: Mood;
}

// firestore collection structure
interface FirestoreRecord {
  uid: string;
  transcript: string;
  transcript_confidence: number;
  mood: {
    mood: string;
    confidence: number;
    evidence?: string[] | null;
  };
  created_at: string;
}

export default class Recorder {
  private isRecording: boolean = false;
  private button: HTMLButtonElement;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordList: RecordList;
  public records: FirestoreRecord[] = [];

  constructor(container: HTMLElement, recordList: RecordList) {
    this.recordList = recordList;
    this.button = document.createElement('button');
    this.button.className = 'recorder-button';
    this.button.addEventListener('click', () => this.toggle());
    container.appendChild(this.button);
  }

  // Button toggle handler
  private toggle(): void {
    if (this.isRecording) {
      this.stop();
    } else {
      this.start();
    }
  }

  // start recording
  private start(): void {
    // gets perms
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        this.audioChunks = [];
        this.mediaRecorder = new MediaRecorder(stream); // new instance
        
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data); // get blob into chunk arr
          }
        };
        
        // on stop event handler
        this.mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' }); //transform blob into webm format
          
          // Upload the audio
          let transcript: Transcript = { uid: '', text: '' };
          try {
            transcript = await this.uploadSpeech(audioBlob);
            console.log('Transcription result:', transcript);
          } catch (err) {
            console.error('Failed to upload audio:', err);
          }
          
          // transcript to gemini
          let geminiResponse: Mood = { uid: '', mood: '', confidence: 0 };
          try {
            if (!transcript || !transcript.text) {
              throw new Error('No transcript available for Gemini upload');
            }
            geminiResponse = await this.uploadTranscript(transcript);
            console.log('Gemini response:', geminiResponse);
          } catch (err) {
            console.error('Failed to get response from Gemini:', err);
          }

          // upload to firestore
          let response: Response = { transcript, mood: geminiResponse };
          try {
            if (!transcript.uid || !geminiResponse.uid || !transcript.text || !geminiResponse.mood) {
              throw new Error('Incomplete data for Firestore upload');
            }
            response = await this.uploadResponse(response);
            console.log('Uploaded response to Firestore:', response);
          } catch (err) {
            console.error('Failed to upload response to Firestore:', err);
          }

          // retrieve from firestore
          this.records = [];
          try {
            this.records = await this.getFromFirestore();
            console.log('Retrieved records from Firestore:', this.records);
            this.recordList?.update(this.records);
          } catch (err) {
            console.error('Failed to retrieve records from Firestore:', err);
          }

          this.audioChunks = [];
        };
        
        this.mediaRecorder.start();
        this.isRecording = true;
        this.updateUI();
        console.log('Recording started');
      })
      .catch(err => {
        console.error('Error accessing microphone:', err);
        this.isRecording = false;
        this.updateUI();
      });
  }

  // stop recording
  private stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.mediaRecorder = null;
    }
    this.isRecording = false;
    this.updateUI();
    console.log('Recording stopped');
  }

  // get records from firestore
  private async getFromFirestore() {
    const response = await fetch(
      'http://localhost:8000/v1/firestore_get/',
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Firestore retrieval failed: ${text}`);
    }

    return await response.json();
  }

  // upload combined response to firestore
  private async uploadResponse(responseData: Response) {
    const response = await fetch(
      'http://localhost:8000/v1/firestore_upload/',
      {
        method: 'POST',
        body: JSON.stringify(responseData),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Firestore upload failed: ${text}`);
    }

    return await response.json();
  }

  // upload audio blob to stt service
  private async uploadSpeech(audioBlob: Blob) {
    const form = new FormData();

    form.append('file', audioBlob, 'speech.webm');

    const response = await fetch(
      'http://localhost:8000/v1/transcribe/',
      {
        method: 'POST',
        body: form,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Transcription failed: ${text}`);
    }

    return await response.json();
  }

  // upload transcript to gemini for mood analysis
  private async uploadTranscript(transcript: Transcript) {
    const response = await fetch(
      'http://localhost:8000/v1/analyze_mood/',
      {
        method: 'POST',
        body: JSON.stringify(transcript),
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Mood analysis failed: ${text}`);
    }

    return await response.json();
  }

  // update button UI
  private updateUI(): void {
    if (this.isRecording) {
      this.button.classList.add('active');
    } else {
      this.button.classList.remove('active');
    }
  }
}
