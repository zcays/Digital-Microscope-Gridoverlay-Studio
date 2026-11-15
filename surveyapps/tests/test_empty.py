"""Empty workspaces must never produce synthetic measurements or exports."""
import unittest
from unittest.mock import patch
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import microscopy_app as m
import dash

class EmptyWorkspace(unittest.TestCase):
    def test_empty_actions(self):
        with patch.object(m, '_uploaded_image', None), patch.object(m, '_raw_uploaded_image', None):
            for action, args in [
                (m.compute_fluorescence, (1, 0, 40, 0, 0, None, 'mean')),
                (m.save_image, (1, 0)),
                (m.save_grid, (1, 0, 40, 0, 0, .5, [])),
                (m.save_merged, (1, 0, 40, 0, 0, .5, [], None, [])),
                (m.crop_well, (1, '0,0', 0, 40, 0, 0)),
                (m.save_csv, (1, None)),
            ]:
                with self.subTest(action=action.__name__), self.assertRaises(dash.exceptions.PreventUpdate):
                    action(*args)
            for trigger in ['.', 'rotation-slider.value', 'btn-apply-crop.n_clicks', 'btn-reset-crop.n_clicks']:
                ctx = type('Context', (), {'triggered': [{'prop_id': trigger}]})()
                with patch.object(m.dash, 'callback_context', ctx):
                    result = m.update_image_and_crop(None, 30, 1, 1, 0, 0, 0, 0)
                    self.assertIsNone(result[0])
                    self.assertIn('Upload', result[-1])
