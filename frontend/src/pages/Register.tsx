import React from 'react';
import { Box, Typography, TextField, Button, Paper, Stack } from '@mui/material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';

type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

const schema = yup.object({
  firstName: yup.string().required('First name is required'),
  lastName: yup.string().required('Last name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().min(6, 'Min 6 characters').required('Password is required'),
}).required();

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await api.post('/auth/register', data);
      toast.success('Account created. Please sign in.');
      navigate('/login', { replace: true });
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.error || 'Registration failed';
      toast.error(msg);
    }
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 480 }}>
        <Stack spacing={2} component="form" onSubmit={handleSubmit(onSubmit)}>
          <Typography variant="h5" textAlign="center">Create an account</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="First name"
              fullWidth
              {...register('firstName')}
              error={!!errors.firstName}
              helperText={errors.firstName?.message}
            />
            <TextField
              label="Last name"
              fullWidth
              {...register('lastName')}
              error={!!errors.lastName}
              helperText={errors.lastName?.message}
            />
          </Stack>
          <TextField
            label="Email"
            fullWidth
            type="email"
            {...register('email')}
            error={!!errors.email}
            helperText={errors.email?.message}
          />
          <TextField
            label="Password"
            fullWidth
            type="password"
            {...register('password')}
            error={!!errors.password}
            helperText={errors.password?.message}
          />
          <Button variant="contained" type="submit" disabled={isSubmitting} fullWidth>
            {isSubmitting ? 'Creating...' : 'Register'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default Register;
