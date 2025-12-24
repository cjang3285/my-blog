import { getConferences, addConference, deleteConference } from '../services/conferenceService.js';

export const getConferencesController = async (req, res) => {
  try {
    const conferences = await getConferences();
    res.json(conferences);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load conferences' });
  }
};

export const addConferenceController = async (req, res) => {
  try {
    const newConference = await addConference(req.body);
    res.status(201).json(newConference);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add conference' });
  }
};

export const deleteConferenceController = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteConference(id);
    if (deleted) {
      res.json({ success: true, deleted });
    } else {
      res.status(404).json({ error: 'Conference not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete conference' });
  }
};
