import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { API, HttpResponse, http, server } from '../test/server.js';
import { renderApp } from '../test/render.jsx';

const noSession = http.post(API('/auth/refresh'), () =>
  HttpResponse.json({ error: 'Please log in again' }, { status: 401 })
);

describe('LoginPage', () => {
  it('validates fields before calling the API', async () => {
    server.use(noSession);
    renderApp('/login');
    await userEvent.click(await screen.findByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
  });

  it("shows the server's error message", async () => {
    server.use(
      noSession,
      http.post(API('/auth/login'), () =>
        HttpResponse.json({ error: 'Email or password is incorrect' }, { status: 401 })
      )
    );
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'ravi@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Wrong1234');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
  });

  it('register validates the password policy', async () => {
    server.use(noSession);
    renderApp('/login');
    await userEvent.click(await screen.findByRole('tab', { name: 'Create account' }));
    await userEvent.type(screen.getByLabelText('Your name'), 'Ravi Kumar');
    await userEvent.type(screen.getByLabelText('Email'), 'ravi@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'abcdefgh');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Password needs at least one number')).toBeInTheDocument();
  });

  it('a contractor lands on the requested page after login', async () => {
    server.use(
      noSession,
      http.post(API('/auth/login'), () =>
        HttpResponse.json({
          user: { _id: 'u1', name: 'Ravi', role: 'contractor' },
          accessToken: 't',
        })
      )
    );
    renderApp('/login?next=/workers');
    await userEvent.type(await screen.findByLabelText('Email'), 'ravi@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Demo@2026');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/workers'));
  });

  it('an admin lands on /admin', async () => {
    server.use(
      noSession,
      http.post(API('/auth/login'), () =>
        HttpResponse.json({ user: { _id: 'a1', name: 'Asha', role: 'admin' }, accessToken: 't' })
      )
    );
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'admin@mazdoorpay.in');
    await userEvent.type(screen.getByLabelText('Password'), 'Admin@2026');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/admin'));
  });

  it('protected pages send anonymous users to login with next', async () => {
    server.use(noSession);
    renderApp('/payments');
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/login?next=%2Fpayments')
    );
  });
});
