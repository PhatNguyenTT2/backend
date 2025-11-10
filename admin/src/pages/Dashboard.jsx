import React from 'react';
import { Layout } from '../components/Layout';
import { PermissionAlert } from '../components/PermissionAlert';

const Home = () => {
  return (
    <Layout>
      <PermissionAlert />
      {/* Dashboard content will go here */}
    </Layout>
  );
};

export default Home;
