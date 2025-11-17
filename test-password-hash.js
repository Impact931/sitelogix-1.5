const bcrypt = require('bcryptjs');

const password = 'SiteLogix123$';
const hash = '$2b$10$DD1vJJvrOOWQSPj./MjFuet3gk/RDW7tzqPYi9MRSNugfvuk2SEc6';

bcrypt.compare(password, hash).then(result => {
  console.log('Password matches:', result);
  if (!result) {
    console.log('\nPassword does NOT match the hash!');
    console.log('Creating new hash...');
    bcrypt.hash(password, 10).then(newHash => {
      console.log('New hash:', newHash);
    });
  }
}).catch(err => console.error('Error:', err));
