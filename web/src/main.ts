import './style.css'
import Recorder from './recorder.ts'
import RecordList from './recordList.ts'

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div>
    <h1>Mood Detection</h1>
    <div id="recorder-container"></div>
    <div id="record-list-container"></div>
  </div>
`;

const recorderContainer = document.querySelector<HTMLDivElement>('#recorder-container')!;
const recordListContainer = document.querySelector<HTMLDivElement>('#record-list-container')!;

const recordList = new RecordList(recordListContainer);
new Recorder(recorderContainer, recordList);