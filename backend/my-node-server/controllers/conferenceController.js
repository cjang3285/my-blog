import { loadConferences, saveConferences } from '../services/conferenceService.js';

export const getConferences = (req, res) => {
  res.json(loadConferences());
};

export const addConference = (req, res) => {
  const list = loadConferences();
  const newItem = { id: Date.now(), ...req.body };
  list.push(newItem);
  saveConferences(list);
  res.json(newItem);
};

export const deleteConference = (req, res) => {
  const id = Number(req.params.id);
  let list = loadConferences();
  list = list.filter(item => item.id !== id);
  saveConferences(list);
  res.json({ success: true });
};
