import React, { createContext, useState } from 'react';

export const BikeContext = createContext();

export const BikeProvider = ({ children }) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [notificationRefresh, setNotificationRefresh] = useState(0);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const triggerNotificationRefresh = () => {
    setNotificationRefresh(prev => prev + 1);
  };

  return (
    <BikeContext.Provider value={{ 
      refreshTrigger, 
      triggerRefresh,
      notificationRefresh,
      triggerNotificationRefresh 
    }}>
      {children}
    </BikeContext.Provider>
  );
};
