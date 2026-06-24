 package com.mohan.pulse.contact.dtos;
                                                                                                                                                                                   
  import lombok.Builder;                                                                                                                                                           
  import lombok.Getter;                                                                                                                                                            
                                                                                                                                                                                   
  @Getter                                                                                                                                                                          
  @Builder                                                                                                                                                                         
  public class SyncedUserResponse {                                                                                                                                                
      private Long userId;                                                                                                                                                         
      private String name;                                                                                                                                                         
      private String avatarUrl;                                                                                                                                                    
      private boolean alreadyContact;                                                                                                                                              
      private Long contactRecordId;                                                                                                                                                
  }                   