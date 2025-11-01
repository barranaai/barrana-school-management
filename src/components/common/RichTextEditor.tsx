import React from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Box } from '@mui/material';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter description...',
  minHeight = 150,
}) => {
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['clean']
    ],
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'color', 'background',
    'align',
    'link', 'image'
  ];

  return (
    <Box
      sx={{
        '& .quill': {
          '& .ql-container': {
            minHeight: `${minHeight}px`,
            fontSize: '1rem',
            fontFamily: 'inherit',
            borderRadius: '4px',
            borderBottomLeftRadius: '4px',
            borderBottomRightRadius: '4px',
          },
          '& .ql-editor': {
            minHeight: `${minHeight}px`,
            '&.ql-blank::before': {
              fontStyle: 'normal',
              color: 'rgba(0, 0, 0, 0.54)',
            },
          },
          '& .ql-toolbar': {
            borderTopLeftRadius: '4px',
            borderTopRightRadius: '4px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.23)',
            backgroundColor: '#f8f9fa',
          },
          '& .ql-stroke': {
            stroke: 'rgba(0, 0, 0, 0.54)',
          },
          '& .ql-fill': {
            fill: 'rgba(0, 0, 0, 0.54)',
          },
          '& .ql-picker-label': {
            color: 'rgba(0, 0, 0, 0.54)',
          },
          '& .ql-picker:hover .ql-picker-label': {
            color: 'rgba(0, 0, 0, 0.87)',
          },
          '& button:hover, & .ql-picker:hover': {
            '& .ql-stroke': {
              stroke: 'rgba(0, 0, 0, 0.87)',
            },
            '& .ql-fill': {
              fill: 'rgba(0, 0, 0, 0.87)',
            },
          },
          '& button.ql-active': {
            '& .ql-stroke': {
              stroke: '#1976d2',
            },
            '& .ql-fill': {
              fill: '#1976d2',
            },
          },
        },
      }}
    >
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
      />
    </Box>
  );
};

export default RichTextEditor;

