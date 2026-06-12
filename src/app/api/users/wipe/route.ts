import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { userId, email } = await request.json();

    if (!userId || !email) {
      return NextResponse.json({ error: 'Missing userId or email' }, { status: 400 });
    }

    console.log(`Starting data wipe for user ${userId} (${email})`);

    const batchSize = 100;
    
    // 1. Tombstone all posts by the user
    console.log("Tombstoning discussions...");
    const postsQuery = await adminDb.collection('discussions').where('authorId', '==', userId).get();
    let postsDeletedCount = 0;
    
    const batchPosts = adminDb.batch();
    postsQuery.docs.forEach((doc: any) => {
      batchPosts.update(doc.ref, {
        authorName: '[Deleted User]',
        authorAvatar: null,
        content: '[Post removed by moderator]',
        title: '[Deleted]'
      });
      postsDeletedCount++;
    });
    if (postsDeletedCount > 0) await batchPosts.commit();

    // 2. Remove user from all likedBy arrays
    console.log("Removing likes...");
    const likesQuery = await adminDb.collection('discussions').where('likedBy', 'array-contains', userId).get();
    let likesRemovedCount = 0;
    const batchLikes = adminDb.batch();
    
    likesQuery.docs.forEach((doc: any) => {
      const data = doc.data();
      const currentLikes = data.likedBy || [];
      const newLikes = currentLikes.filter((id: string) => id !== userId);
      
      batchLikes.update(doc.ref, {
        likedBy: newLikes,
        likesCount: newLikes.length
      });
      likesRemovedCount++;
    });
    if (likesRemovedCount > 0) await batchLikes.commit();

    // 3. Tombstone comments by the user (like Reddit)
    console.log("Tombstoning comments...");
    let commentsDeletedCount = 0;
    let commentsError = null;
    try {
      const commentsQuery = await adminDb.collectionGroup('comments').where('authorId', '==', userId).get();
      const batchComments = adminDb.batch();
      commentsQuery.docs.forEach((doc: any) => {
        batchComments.update(doc.ref, {
          authorName: '[Deleted User]',
          authorAvatar: null,
          content: '[Comment removed by moderator]' // Optional: remove this line if you want to keep the original text
        });
        commentsDeletedCount++;
      });
      
      const commentDocs = commentsQuery.docs;
      for (let i = 0; i < commentDocs.length; i += 500) {
        const chunk = commentDocs.slice(i, i + 500);
        const tempBatch = adminDb.batch();
        chunk.forEach((d: any) => tempBatch.update(d.ref, {
          authorName: '[Deleted User]',
          authorAvatar: null,
          content: '[Comment removed by moderator]'
        }));
        await tempBatch.commit();
      }
    } catch (err: any) {
      console.warn("Failed to delete comments (likely missing collectionGroup index):", err.message);
      commentsError = err.message;
    }

    // 4. Delete notifications sent by this user
    console.log("Deleting notifications...");
    const notifsQuery = await adminDb.collection('discussion_notifications').where('senderId', '==', userId).get();
    const notifDocs = notifsQuery.docs;
    for (let i = 0; i < notifDocs.length; i += 500) {
      const chunk = notifDocs.slice(i, i + 500);
      const tempBatch = adminDb.batch();
      chunk.forEach((d: any) => tempBatch.delete(d.ref));
      await tempBatch.commit();
    }

    // 5. Delete from other potential collections (marketplace, lost items, rooms, mess)
    const collectionsToClear = ['marketItems', 'lostItems', 'rooms', 'mess'];
    for (const colName of collectionsToClear) {
       // usually ownerid, sellerId, or userId.
       let ownerField = 'userId';
       if (colName === 'rooms' || colName === 'mess') ownerField = 'ownerid';
       if (colName === 'marketItems') ownerField = 'sellerId';

       const colQuery = await adminDb.collection(colName).where(ownerField, '==', userId).get();
       const colDocs = colQuery.docs;
       for (let i = 0; i < colDocs.length; i += 500) {
         const chunk = colDocs.slice(i, i + 500);
         const tempBatch = adminDb.batch();
         chunk.forEach((d: any) => tempBatch.delete(d.ref));
         await tempBatch.commit();
       }
    }

    // 6. Finally, delete the user profile itself
    console.log("Deleting user profile...");
    await adminDb.collection('users').doc(userId).delete();

    console.log(`Successfully wiped data for user ${userId}.`);

    return NextResponse.json({ 
      success: true, 
      message: 'User data wiped completely.',
      commentsError: commentsError
    });

  } catch (error: any) {
    console.error('Error in wipe route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
